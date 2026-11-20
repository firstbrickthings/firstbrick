from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.testclient import TestClient
from app.config import Settings


def test_canonical_domain_and_previous_origins_are_allowed_without_opening_other_origins():
    config = Settings(_env_file=None, allowed_origins='https://previous.example, https://other.example',
                      public_store_url='https://babyone.babyonestore.com/')
    assert config.origins[:2] == ['https://previous.example', 'https://other.example']
    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origins=config.origins, allow_credentials=True,
                       allow_methods=['GET'], allow_headers=['Content-Type'])
    with TestClient(app) as client:
        for origin in ['https://previous.example', 'https://other.example', 'https://babyone.babyonestore.com']:
            response = client.options('/api/auth/config', headers={
                'Origin': origin, 'Access-Control-Request-Method': 'GET'})
            assert response.status_code == 200
            assert response.headers['Access-Control-Allow-Origin'] == origin
        response = client.options('/api/auth/config', headers={
            'Origin': 'https://unrelated.example', 'Access-Control-Request-Method': 'GET'})
        assert response.status_code == 400
        assert 'Access-Control-Allow-Origin' not in response.headers


def test_existing_canonical_origin_is_not_duplicated():
    config = Settings(_env_file=None, allowed_origins=' https://babyone.babyonestore.com ',
                      public_store_url='https://babyone.babyonestore.com/')
    assert config.origins == ['https://babyone.babyonestore.com']
