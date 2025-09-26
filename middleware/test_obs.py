import requests

data = {
    "username": "kjh",
    "color": {"r": 0, "g": 0, "b": 0}
}
response = requests.post("http://127.0.0.1:5001/api/color", json=data)
print("Status:", response.status_code)
print("Response:", response.text)