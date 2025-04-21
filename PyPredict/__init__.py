print("Initializing Python environment...")
import pandas as pd
import numpy as np
import os
import torch

filesystem="\\" if os.name=="nt" else "/"
DataDirectory=os.getcwd()+f"{filesystem}MarketData"
if not os.path.isdir(DataDirectory):
    os.mkdir(DataDirectory)

print("Initialization complete")