import requests
from time import sleep
from random import randint, random

# Target URL
url = "http://localhost:5000/sensor"

# Query parameters
params = {
    "room": "ICU-101"
}

for x in range(10):
    data = {
        "heart_rate": randint(80,110),
        "spO2": randint(90,100),
        "temp": randint(34,40)+round(random(),2),
        "resp_rate": randint(10,20)+round(random(),2),
        "ABP": f"{randint(110,130)}/{randint(70,90)}"
    }
    response = requests.post(url, params=params, json=data)
    print("Status Code:", response.status_code)
    print("Response:", response.text)
    sleep(3)

