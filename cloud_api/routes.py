from flask import request, jsonify
from datetime import datetime, timezone
import logging

from better_profanity import profanity

logger = logging.getLogger(__name__)

# Initialize profanity filter
profanity.load_censor_words()

def register_routes(app, store):
    """Register all API routes with the Flask app"""

    @app.route('/', methods=['GET'])
    def health_check():
        """Health check endpoint"""
        bridge_status = store.get_bridge_status()
        return jsonify({
            'status': 'healthy',
            'service': 'RGBoo Cloud API',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'bridge_online': bridge_status['bridge_online'],
            'serial_connected': bridge_status['serial_connected']
        })

    @app.route('/api/color', methods=['POST'])
    def set_color():
        """
        Main API endpoint to set RGB color
        Expected JSON payload:
        {
            "username": "string",
            "color": {
                "r": 255,
                "g": 128,
                "b": 64
            }
        }
        """
        try:
            # Validate request
            if not request.is_json:
                return jsonify({'error': 'Request must be JSON'}), 400

            data = request.get_json()

            # Validate required fields
            if 'username' not in data:
                return jsonify({'error': 'Username is required'}), 400

            if 'color' not in data:
                return jsonify({'error': 'Color is required'}), 400

            color = data['color']
            username = data['username']

            # Check username for profanity
            if profanity.contains_profanity(username):
                logger.warning(f"Profanity detected in username: '{username}'")
                return jsonify({
                    'error': 'Username contains inappropriate language. Please choose a different username.',
                    'code': 'PROFANITY_DETECTED'
                }), 400

            # Blocked by an admin clear. One extra read per submission.
            if store.is_blocked(username):
                logger.warning(f"Blocked username attempted: '{username}'")
                return jsonify({
                    'error': 'Username contains inappropriate language. Please choose a different username.',
                    'code': 'PROFANITY_DETECTED'
                }), 400

            # Validate color format
            if not all(key in color for key in ['r', 'g', 'b']):
                return jsonify({'error': 'Color must have r, g, b values'}), 400

            # Validate color values (0-255)
            for component in ['r', 'g', 'b']:
                if not isinstance(color[component], int) or not (0 <= color[component] <= 255):
                    return jsonify({'error': f'Color {component} must be integer between 0-255'}), 400

            # Log the request
            logger.info(f"Color change request from user '{username}': RGB({color['r']}, {color['g']}, {color['b']})")

            # Add color request to queue with proper timing
            color_request = store.add_request(username, color['r'], color['g'], color['b'])

            response = {
                'status': 'queued',
                'message': f'Color request queued successfully - Position {color_request["queue_position"]} in queue, estimated wait: {color_request["estimated_wait_seconds"]} seconds',
                'username': username,
                'color': color,
                'request_id': color_request['request_id'],
                'queue_position': color_request['queue_position'],
                'estimated_wait_seconds': color_request['estimated_wait_seconds'],
                'scheduled_time': color_request['scheduled_time'].isoformat(),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }
            logger.info(f"Successfully queued color request for user '{username}' (ID: {color_request['request_id']}) - Position: {color_request['queue_position']}, Wait: {color_request['estimated_wait_seconds']}s")
            return jsonify(response), 200

        except Exception as e:
            logger.error(f"Error processing color request: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Internal server error',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }), 500


    @app.route('/api/status', methods=['GET'])
    def get_status():
        """Get current system status"""
        bridge_status = store.get_bridge_status()
        return jsonify({
            'serial_connected': bridge_status['serial_connected'],
            'serial_port': bridge_status['serial_port'],
            'bridge_online': bridge_status['bridge_online'],
            'uptime': datetime.now(timezone.utc).isoformat(),
            'queue_status': store.get_queue_status()
        })

    @app.route('/api/queue', methods=['GET'])
    def get_queue_status():
        """Get detailed queue status"""
        status = store.get_queue_status()
        status['queue_contents'] = store.get_queue_contents()
        return jsonify(status)

    @app.route('/admin/status', methods=['GET'])
    def get_admin_status():
        """Return the current displayed user and the next ten pending users."""
        return jsonify({
            'current_username': store.get_current_username(),
            'queue': store.get_queue_contents(limit=10),
            # get_queue_size() alone; the full status also reads the pacing and
            # bridge docs, which this poll-heavy endpoint doesn't need.
            'queue_size': store.get_queue_size(),
        })

    @app.route('/admin/queue/remove', methods=['POST'])
    def remove_queue_request():
        """Cancel one pending request by its unique request ID."""
        data = request.get_json(silent=True) or {}
        request_id = data.get('request_id')
        if not isinstance(request_id, str) or not request_id.strip():
            return jsonify({'error': 'Request ID is required'}), 400

        cancelled_count = store.cancel_request(request_id)
        return jsonify({
            'status': 'success',
            'request_id': request_id,
            'cancelled_count': cancelled_count,
            'message': f'Cancelled {cancelled_count} request(s)',
        })

    @app.route('/admin/queue/clear', methods=['POST'])
    def clear_queue():
        """Cancel every pending request.

        Admin-only: this cancels other people's queued colours, so it is not
        something a visitor should be able to trigger. Under /admin/* the
        Worker will not proxy it and X-Admin-Key is required. To remove one
        person instead, use /admin/clear-current.
        """
        cleared_count = store.clear_queue()
        return jsonify({
            'status': 'success',
            'message': f'Cleared {cleared_count} requests from queue',
            'cleared_count': cleared_count
        })

    @app.route('/admin/clear-current', methods=['POST'])
    def clear_current_user():
        """Pull the currently displayed user off the stream.

        Unlike /admin/queue/clear this touches one person: blanks the overlay,
        cancels only their pending requests, redacts their name. Requires
        X-Admin-Key; the Worker's API key is not accepted.
        """
        try:
            data = request.get_json(silent=True) or {}
            username = data.get('username') or store.get_current_username()

            if not username:
                # Nothing on screen, or already cleared: pressing twice is safe.
                return jsonify({
                    'status': 'success',
                    'cleared_username': None,
                    'cancelled_count': 0,
                    'redacted_count': 0,
                    'blocked': False,
                    'bridge_online': store.get_bridge_status()['bridge_online'],
                    'message': 'Nothing is currently displayed'
                }), 200

            cancelled_count = store.cancel_pending_for_user(username)
            redacted_count = store.redact_username(username)

            blocked = bool(data.get('block'))
            if blocked:
                store.block_username(username)

            # Last, so the overlay blanks only once the queue is safe.
            store.request_overlay_clear()

            bridge_online = store.get_bridge_status()['bridge_online']
            logger.warning(
                f"Admin cleared the current user: cancelled {cancelled_count}, "
                f"redacted {redacted_count}, blocked={blocked}"
            )

            return jsonify({
                'status': 'success',
                'cleared_username': username,
                'cancelled_count': cancelled_count,
                'redacted_count': redacted_count,
                'blocked': blocked,
                'bridge_online': bridge_online,
                'message': (
                    f'Cleared {username} from the overlay, '
                    f'cancelled {cancelled_count} pending requests'
                )
            }), 200

        except Exception as e:
            logger.error(f"Error clearing current user: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Internal server error',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }), 500

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Endpoint not found'}), 404

    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
