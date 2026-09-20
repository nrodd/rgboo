"""Home-machine bridge: Firestore queue -> USB serial -> ESP32.

The cloud API (cloud_api/) accepts color requests and parks them in
Firestore with a scheduled_time. This package is the half that cannot
move to the cloud: it watches Firestore for pending requests, waits for
each one's slot, and writes the color out over USB serial.
"""
