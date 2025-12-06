
from connection import get_formations, get_wells
import time

print("Testing get_formations...")
start = time.time()
try:
    formations = get_formations()
    print(f"Formations: {formations}")
except Exception as e:
    print(f"Error in get_formations: {e}")
print(f"Time taken: {time.time() - start:.2f}s")

print("\nTesting get_wells...")
start = time.time()
try:
    wells = get_wells()
    print(f"Wells data length: {len(wells)}")
except Exception as e:
    print(f"Error in get_wells: {e}")
print(f"Time taken: {time.time() - start:.2f}s")
