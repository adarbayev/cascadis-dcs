from __future__ import annotations

from fastapi.testclient import TestClient

from dc_cooling.main import create_app
from dc_cooling.schemas import GridSource, WaterSource

from conftest import (
    FakeGridProvider,
    FakeWaterProvider,
    make_fields,
    make_grid,
    make_water,
)


def test_health_and_policy_are_versioned(client: TestClient) -> None:
    health = client.get("/api/v1/health")
    assert health.status_code == 200
    assert health.json()["policy_version"] == "1.0.0"

    policy = client.get("/api/v1/policy")
    assert policy.status_code == 200
    assert policy.json()["anchors"]["carbon_gco2e_per_kwh"] == 800


def test_complete_assessment_persists_and_exposes_contract(
    client: TestClient,
    base_location: dict[str, object],
) -> None:
    response = client.post(
        "/api/v1/assessments",
        json={"locations": [base_location], "weights": {"water": 0.5, "carbon": 0.5}},
    )
    assert response.status_code == 201
    body = response.json()
    assert len(body["assessments"]) == 1
    result = body["assessments"][0]
    assert set(result) == {
        "assessment_id",
        "status",
        "site",
        "source",
        "policy_v1",
        "warnings",
        "provenance",
        "created_at",
    }
    assert result["status"] == "complete"
    assert result["policy_v1"]["scores"]["environmental_priority"] == 81.25
    assert result["policy_v1"]["matrix_cell"]["id"] == "high_or_arid"
    assert result["policy_v1"]["recommendations"]["energy_procurement_lever"] == {
        "category": "Renewable power purchase agreement assessment",
        "priority": "high",
        "affects_location_based_score": False,
        "rationale": (
            "High grid intensity increases the value of a commercial PPA assessment. "
            "It does not change the location-based factor or location-based CUE."
        ),
    }
    assert result["policy_v1"]["proxy_metrics"] == {
        "cue_location_based_kgco2e_per_kwh_it": 0.81,
        "annual_operational_emissions_tco2e": 810.0,
        "annual_water_use_m3": 400.0,
        "factor_basis": "national lifecycle generation intensity",
    }
    assert any("approved maintenance window" in item for item in result["policy_v1"]["delivery"]["maintenance_window"])
    assert result["source"]["water"]["fields"]["bws_score"] == 5

    assessment_id = result["assessment_id"]
    fetched = client.get(f"/api/v1/assessments/{assessment_id}")
    assert fetched.status_code == 200
    assert fetched.json()["assessment_id"] == assessment_id
    portfolio = client.get("/api/v1/portfolio")
    assert portfolio.status_code == 200
    assert portfolio.json()["count"] == 1


def test_batch_and_weight_validation(client: TestClient, base_location: dict[str, object]) -> None:
    invalid_weights = client.post(
        "/api/v1/assessments",
        json={"locations": [base_location], "weights": {"water": 0.7, "carbon": 0.4}},
    )
    assert invalid_weights.status_code == 422

    duplicate = client.post(
        "/api/v1/assessments",
        json={"locations": [base_location, base_location]},
    )
    assert duplicate.status_code == 422

    too_many = [dict(base_location, id=f"site-{index}") for index in range(101)]
    response = client.post("/api/v1/assessments", json={"locations": too_many})
    assert response.status_code == 422

    invalid_energy = client.post(
        "/api/v1/assessments",
        json={"locations": [dict(base_location, annual_it_energy_mwh=0)]},
    )
    assert invalid_energy.status_code == 422


def test_batch_accepts_exactly_one_hundred_sites(
    client: TestClient,
    base_location: dict[str, object],
) -> None:
    locations = [
        dict(base_location, id=f"site-{index}", name=f"Site {index}")
        for index in range(100)
    ]
    response = client.post("/api/v1/assessments", json={"locations": locations})
    assert response.status_code == 201
    assert len(response.json()["assessments"]) == 100


def test_no_data_sentinel_blocks_composite(settings, base_location) -> None:
    fields = make_fields(bws_score=-9999, bws_cat=-9999, bws_label="No Data")
    water = make_water(fields)
    water.data_status = "no_data"
    app = create_app(
        settings,
        water_provider=FakeWaterProvider({"phoenix-1": water}),
        grid_provider=FakeGridProvider(),
    )
    with TestClient(app) as test_client:
        response = test_client.post("/api/v1/assessments", json={"locations": [base_location]})
    result = response.json()["assessments"][0]
    assert result["status"] == "partial"
    assert result["source"]["water"]["fields"]["bws_score"] == -9999
    assert result["policy_v1"]["scores"]["water_normalized"] is None
    assert result["policy_v1"]["scores"]["environmental_priority"] is None
    assert all(
        detail["environmental_priority"] is None
        for detail in result["policy_v1"]["scores"]["sensitivity"].values()
    )
    assert result["policy_v1"]["matrix_cell"]["id"] == "unknown"

    app = create_app(
        settings,
        water_provider=FakeWaterProvider({"phoenix-1": water}),
        grid_provider=FakeGridProvider(),
    )
    with TestClient(app) as test_client:
        alternate = test_client.post(
            "/api/v1/assessments",
            json={"locations": [base_location], "water_view": "electric_power"},
        )
    alternate_scores = alternate.json()["assessments"][0]["policy_v1"]["scores"]
    assert alternate_scores["water_normalized"] is None
    assert alternate_scores["environmental_priority"] is None


def test_arid_sentinel_is_critical_policy_override(settings, base_location) -> None:
    fields = make_fields(
        bws_score=-1,
        bws_cat=-1,
        bws_label="Arid and Low Water Use",
    )
    app = create_app(
        settings,
        water_provider=FakeWaterProvider({"phoenix-1": make_water(fields)}),
        grid_provider=FakeGridProvider(),
    )
    with TestClient(app) as test_client:
        response = test_client.post("/api/v1/assessments", json={"locations": [base_location]})
    result = response.json()["assessments"][0]
    assert result["source"]["water"]["fields"]["bws_score"] == -1
    assert result["policy_v1"]["scores"]["water_normalized"] == 1
    assert result["policy_v1"]["matrix_cell"]["water_band"] == "high_or_arid"
    assert any("critical review" in warning for warning in result["warnings"])


def test_alternative_view_changes_score_but_not_cooling_water_band(settings, base_location) -> None:
    fields = make_fields(
        bws_score=1,
        bws_cat=1,
        bws_label="Low-Medium",
        electric_score=5,
        electric_cat=4,
    )
    app = create_app(
        settings,
        water_provider=FakeWaterProvider({"phoenix-1": make_water(fields)}),
        grid_provider=FakeGridProvider(make_grid(500)),
    )
    with TestClient(app) as test_client:
        response = test_client.post(
            "/api/v1/assessments",
            json={"locations": [base_location], "water_view": "electric_power"},
        )
    result = response.json()["assessments"][0]
    assert result["policy_v1"]["scores"]["water_normalized"] == 1
    assert result["policy_v1"]["matrix_cell"]["water_band"] == "low"
    assert result["policy_v1"]["matrix_cell"]["id"] == "low_high_carbon"


def test_rank_reversal_requires_portfolio_order_change(settings, base_location) -> None:
    site_a_fields = make_fields(
        bws_score=5,
        bws_cat=4,
        electric_score=1,
        electric_cat=1,
    )
    site_b_fields = make_fields(
        bws_score=1,
        bws_cat=1,
        bws_label="Low-Medium",
        electric_score=5,
        electric_cat=4,
    )
    water_provider = FakeWaterProvider(
        {
            "site-a": make_water(site_a_fields),
            "site-b": make_water(site_b_fields),
        }
    )
    app = create_app(
        settings,
        water_provider=water_provider,
        grid_provider=FakeGridProvider(make_grid(200)),
    )
    locations = [
        dict(base_location, id="site-a", name="Site A"),
        dict(base_location, id="site-b", name="Site B"),
    ]
    with TestClient(app) as test_client:
        response = test_client.post("/api/v1/assessments", json={"locations": locations})
    results = response.json()["assessments"]
    assert results[0]["policy_v1"]["scores"]["rank_by_view"]["baseline_water_stress"] == 1
    assert results[0]["policy_v1"]["scores"]["rank_by_view"]["electric_power"] == 2
    assert all(item["policy_v1"]["scores"]["rank_reversal_warning"] for item in results)


def test_portfolio_recomputes_ranks_across_separate_assessments(settings, base_location) -> None:
    provider = FakeWaterProvider(
        {
            "site-a": make_water(
                make_fields(bws_score=5, bws_cat=4, electric_score=1, electric_cat=1)
            ),
            "site-b": make_water(
                make_fields(
                    bws_score=1,
                    bws_cat=1,
                    bws_label="Low-Medium",
                    electric_score=5,
                    electric_cat=4,
                )
            ),
        }
    )
    app = create_app(
        settings,
        water_provider=provider,
        grid_provider=FakeGridProvider(make_grid(200)),
    )
    with TestClient(app) as test_client:
        for site_id in ("site-a", "site-b"):
            response = test_client.post(
                "/api/v1/assessments",
                json={
                    "locations": [dict(base_location, id=site_id, name=site_id.title())]
                },
            )
            assert response.status_code == 201
            assert response.json()["assessments"][0]["policy_v1"]["scores"][
                "rank_reversal_warning"
            ] is False
        portfolio = test_client.get("/api/v1/portfolio?limit=2")
    results = portfolio.json()["assessments"]
    assert len(results) == 2
    assert all(item["policy_v1"]["scores"]["rank_reversal_warning"] for item in results)


def test_portfolio_blocks_ranking_across_persisted_mixed_grid_bases(
    settings,
    base_location,
) -> None:
    ember_app = create_app(
        settings,
        water_provider=FakeWaterProvider(),
        grid_provider=FakeGridProvider(make_grid(300)),
    )
    with TestClient(ember_app) as test_client:
        response = test_client.post(
            "/api/v1/assessments",
            json={"locations": [dict(base_location, id="ember-site", name="Ember Site")]},
        )
        assert response.status_code == 201

    iea_grid = make_grid(250).model_copy(
        update={
            "provider": "iea_annual_file",
            "dataset": "Licensed IEA annual factors",
            "factor_basis": "national direct operational intensity",
            "source_url": "https://example.test/licensed-iea-file",
            "transport": "local_file",
        }
    )
    iea_app = create_app(
        settings,
        water_provider=FakeWaterProvider(),
        grid_provider=FakeGridProvider(iea_grid),
    )
    with TestClient(iea_app) as test_client:
        response = test_client.post(
            "/api/v1/assessments",
            json={"locations": [dict(base_location, id="iea-site", name="IEA Site")]},
        )
        assert response.status_code == 201
        portfolio = test_client.get("/api/v1/portfolio?limit=2")

    results = portfolio.json()["assessments"]
    assert len(results) == 2
    assert all(item["policy_v1"]["scores"]["rank_by_view"] == {} for item in results)
    assert all(
        any("Combined portfolio ranking is blocked" in warning for warning in item["warnings"])
        for item in results
    )


def test_missing_grid_factor_is_not_zero_filled(settings, base_location) -> None:
    missing = GridSource(
        data_status="not_configured",
        source_url="https://example.test/ember",
        error="Missing source",
    )
    app = create_app(
        settings,
        water_provider=FakeWaterProvider(),
        grid_provider=FakeGridProvider(missing),
    )
    with TestClient(app) as test_client:
        response = test_client.post("/api/v1/assessments", json={"locations": [base_location]})
    scores = response.json()["assessments"][0]["policy_v1"]["scores"]
    assert scores["carbon_normalized"] is None
    assert scores["environmental_priority"] is None


def test_source_status_exposes_disabled_contracts(client: TestClient) -> None:
    response = client.get("/api/v1/sources/status")
    assert response.status_code == 200
    status = {item["provider"]: item for item in response.json()["sources"]}
    assert status["aqueduct_local"]["enabled"] is False
    assert status["iea_annual_file"]["enabled"] is False
    assert status["ember"]["mode"] == "public_csv_with_sqlite_cache"


def test_missing_assessment_returns_404(client: TestClient) -> None:
    assert client.get("/api/v1/assessments/missing").status_code == 404
