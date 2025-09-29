import requests

data = {
    "username": "na10",
    "color": {"r": 255, "g": 0, "b": 255}
}
response = requests.post("http://127.0.0.1:5001/api/color", json=data)
print("Status:", response.status_code)
print("Response:", response.text)