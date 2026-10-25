import httpx

from app.config import settings
from app.services import coach as coach_service


def test_fallback_when_not_configured(client):
    client.post("/api/demo")
    r = client.post("/api/coach", json={"question": "How can I save water?"}).json()
    assert r["source"] == "fallback"
    assert r["recommendations"]
    assert all(rec["resource"] == "water" for rec in r["recommendations"])


def test_fallback_with_no_data_says_so(client):
    r = client.post("/api/coach", json={"question": "Any tips?"}).json()
    assert r["source"] == "fallback"
    assert "not enough" in r["summary"].lower()


def test_question_is_validated(client):
    assert client.post("/api/coach", json={"question": ""}).status_code == 422
    assert client.post("/api/coach", json={"question": "x" * 501}).status_code == 422


def _configure(monkeypatch):
    monkeypatch.setattr(settings, "n8n_webhook_url", "http://n8n.test/webhook/ecotrack-coach")
    monkeypatch.setattr(settings, "n8n_shared_secret", type(settings.n8n_shared_secret)("s3cret"))


def test_valid_ai_response_is_used(client, monkeypatch):
    client.post("/api/demo")
    _configure(monkeypatch)
    good = {"summary": "Showers are your largest use.",
            "recommendations": [{"title": "Shorter showers", "why": "Largest share.", "resource": "water", "effort": "easy"}],
            "data_note": "Estimates only."}
    sent = {}

    def fake_post(url, json, headers, timeout):
        sent.update(json=json, headers=headers)
        return httpx.Response(200, json=good, request=httpx.Request("POST", url))

    monkeypatch.setattr(coach_service.httpx, "post", fake_post)
    r = client.post("/api/coach", json={"question": "Tips?"}).json()
    assert r["source"] == "ai"
    assert r["summary"] == good["summary"]
    assert sent["headers"]["X-EcoTrack-Secret"] == "s3cret"
    assert "Demo data" not in str(sent["json"])      # record notes never leave the app
    assert sent["json"]["water"]["total_litres"] > 0


def test_invalid_ai_response_falls_back(client, monkeypatch):
    _configure(monkeypatch)
    monkeypatch.setattr(coach_service.httpx, "post",
                        lambda url, **kw: httpx.Response(200, json={"oops": True}, request=httpx.Request("POST", url)))
    r = client.post("/api/coach", json={"question": "Tips?"}).json()
    assert r["source"] == "fallback"
    assert "format" in r["fallback_reason"]


def test_timeout_falls_back(client, monkeypatch):
    _configure(monkeypatch)

    def slow(url, **kw):
        raise httpx.ReadTimeout("too slow")

    monkeypatch.setattr(coach_service.httpx, "post", slow)
    r = client.post("/api/coach", json={"question": "Tips?"}).json()
    assert r["source"] == "fallback"
    assert "timed out" in r["fallback_reason"]