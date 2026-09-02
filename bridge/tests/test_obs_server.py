from ..obs_server import TEMPLATE_DIR, create_obs_app, make_obs_callback

"""
Unit tests for the embedded OBS browser source (bridge/obs_server.py).
The routes, local-IP check and template come from middleware/obs.py
unchanged; these check the bridge wires them up correctly.
"""


"""Test the reused middleware template is actually resolvable from here"""
def test_template_directory_exists():
    assert (TEMPLATE_DIR / 'obs_browser_source.html').is_file()


"""Test /obs is served to a local client"""
def test_obs_page_served_locally():
    app, _ = create_obs_app('test-secret')
    app.testing = True

    response = app.test_client().get('/obs', environ_overrides={'REMOTE_ADDR': '127.0.0.1'})

    assert response.status_code == 200


"""Test the local-only check still blocks external access"""
def test_obs_page_blocked_for_external_client():
    app, _ = create_obs_app('test-secret')
    app.testing = True

    response = app.test_client().get('/obs', environ_overrides={'REMOTE_ADDR': '203.0.113.5'})

    assert response.status_code == 403


"""Test the dispatched username reaches the OBS overlay"""
def test_obs_callback_broadcasts_username():
    app, socketio = create_obs_app('test-secret')
    callback = make_obs_callback(socketio)

    with app.app_context():
        assert callback('tester') is True
