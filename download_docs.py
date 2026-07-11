import os
import requests
from bs4 import BeautifulSoup


ASSIGNMENTS_API = "https://student-portal-3-tos6.onrender.com/api/student/69ac61ef7b74cd2b4250afd3/assignments"
MATERIALS_API = "https://student-portal-3-tos6.onrender.com/materials"


os.makedirs("data/assignments", exist_ok=True)
os.makedirs("data/materials", exist_ok=True)



def fetch_assignments():

    print("Fetching assignments...")

    r = requests.get(ASSIGNMENTS_API)

    if r.status_code != 200:
        print("Assignments API failed")
        return []

    res = r.json()

    return res["data"]["assignments"]["upcoming"]



def fetch_materials():

    print("Fetching materials...")

    r = requests.get(MATERIALS_API)

    if r.status_code != 200:
        print("Materials API failed")
        return []

    res = r.json()

    return res["data"]



def extract_pdf_from_collection(collection_url):

    print("Extracting file from Cloudinary collection:", collection_url)

    r = requests.get(collection_url)

    if r.status_code != 200:
        print("Failed to open collection page")
        return None

    soup = BeautifulSoup(r.text, "html.parser")

    for a in soup.find_all("a"):

        href = a.get("href")

        if href and ".pdf" in href:

            if href.startswith("http"):
                return href

            return "https:" + href

    print("No PDF found in collection")

    return None



def download_pdf(url, save_path):

    try:

        if "collection.cloudinary.com" in url:

            url = extract_pdf_from_collection(url)

            if url is None:
                return None

        r = requests.get(url)

        if r.status_code != 200:
            print("Download failed:", url)
            return None

        with open(save_path, "wb") as f:
            f.write(r.content)

        print("Downloaded:", save_path)

        return save_path

    except Exception as e:

        print("Error downloading file:", e)

        return None



def download_assignments():

    assignments = fetch_assignments()

    paths = []

    for a in assignments:

        title = a["title"]

        url = a["assignmentDoc"]

        filename = title.replace(" ", "_") + ".pdf"

        path = os.path.join("data/assignments", filename)

        file = download_pdf(url, path)

        if file:
            paths.append(file)

    return paths



def download_materials():

    materials = fetch_materials()

    paths = []

    for m in materials:

        title = m["title"]

        url = m["materialLink"]

        filename = title.replace(" ", "_") + ".pdf"

        path = os.path.join("data/materials", filename)

        file = download_pdf(url, path)

        if file:
            paths.append(file)

    return paths



if __name__ == "__main__":

    print("\nDownloading Assignments...\n")

    assignment_files = download_assignments()

    print("\nDownloading Materials...\n")

    material_files = download_materials()

    print("\nFinished downloading files\n")

    print("Assignments:", assignment_files)

    print("Materials:", material_files)