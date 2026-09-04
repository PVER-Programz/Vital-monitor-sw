import requests
from time import sleep
from random import randint, random

# Target URL
url = "http://localhost:5000/sensor"

# Query parameters
params = {
	"room": "ICU-101"
}

data = {
		"heart_rate": 97,
		"spO2": 99,
		"temp": 37,
		"resp_rate": randint(10,20)+round(random(),2),
		"ABP": f"{randint(110,130)}/{randint(70,90)}"
	}
response = requests.post(url, params=params, json=data)
print("Status Code:", response.status_code)
print("Response:", response.text)
