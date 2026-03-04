from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader

from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(title="AI Career Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load embedding model once when server starts (fast + efficient)
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> str:
    """Extracts text from a PDF (bytes)."""
    import io
    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages_text = []
    for page in reader.pages:
        t = page.extract_text() or ""
        pages_text.append(t)
    return "\n".join(pages_text).strip()


def clean_text(text: str) -> str:
    """Basic cleanup to make matching cleaner."""
    return " ".join((text or "").replace("\n", " ").split())


import re

SKILL_PATTERNS = [
    # Languages
    r"\bpython\b", r"\bjava\b", r"\bgolang\b", r"\bgo\b", r"\bjavascript\b", r"\btypescript\b",
    # Frontend
    r"\breact\b", r"\bredux\b",
    # Backend/API
    r"\bfastapi\b", r"\bnode\.?js\b", r"\brestful?\s+apis?\b", r"\brest\s+apis?\b",
    # DevOps/Cloud
    r"\bdocker\b", r"\bkubernetes\b", r"\bopenshift\b", r"\bcontainer(s)?\b",
    # Tools/Practices
    r"\bci\/cd\b", r"\bagile\b", r"\bunit\s+testing\b", r"\bmlflow\b", r"\blangchain\b", r"\blanggraph\b",
]

# Pretty labels for display
SKILL_NORMALIZE = {
    "rest api": "REST APIs",
    "restful api": "REST APIs",
    "restful apis": "REST APIs",
    "rest apis": "REST APIs",
    "node.js": "Node.js",
    "ci/cd": "CI/CD",
    "golang": "Golang",
    "go": "Go",
    "openshift": "OpenShift",
    "kubernetes": "Kubernetes",
    "docker": "Docker",
    "react": "React",
    "redux": "Redux",
    "python": "Python",
    "java": "Java",
    "javascript": "JavaScript",
    "typescript": "TypeScript",
    "fastapi": "FastAPI",
    "container": "Containers",
    "containers": "Containers",
}


def normalize_skill(raw: str) -> str:
    s = raw.lower().strip()
    s = re.sub(r"\s+", " ", s)
    s = s.replace("restful apis", "restful apis")
    return SKILL_NORMALIZE.get(s, raw.strip())

def extract_skills(text: str):
    """
    Extracts skills from text using regex patterns.
    Returns a sorted unique list of normalized skill names.
    """
    t = text.lower()
    found = set()

    for pat in SKILL_PATTERNS:
        for m in re.finditer(pat, t, flags=re.IGNORECASE):
            skill = m.group(0)
            skill = skill.strip()
            found.add(normalize_skill(skill))

    # clean weird outputs like "containers" and duplicates already handled by set
    return sorted(found)

def build_recommendations(score: float, present: list[str], missing: list[str]) -> list[str]:
    recs: list[str] = []

    # Score-based guidance
    if score < 40:
        recs.append("Low match score: tailor your resume summary + top project bullets to mirror the job description language.")
        recs.append("Add a short 'Core Skills' section near the top (8–12 skills) to help ATS + recruiters scan faster.")
    elif score < 70:
        recs.append("Moderate match score: you’re partially aligned—strengthen 2–3 project bullets to match this role’s requirements.")
    else:
        recs.append("Strong match score: you look well aligned—focus on making accomplishments measurable (impact, scale, metrics).")

    # Skill gap guidance
    if missing:
        top_missing = missing[:5]
        recs.append(
            "Skills missing from your resume (only add if you truly have experience): "
            + ", ".join(top_missing)
            + "."
        )

    if present:
        top_present = present[:4]
        recs.append(
            "Good signals already present: "
            + ", ".join(top_present)
            + ". Make sure these appear in your project bullets (not only a skills list)."
        )

    # General resume improvements
    recs.append("For each project, add a 'Tech Stack' line (e.g., React, FastAPI, Docker) so technical keywords are clearly visible.")
    recs.append("Rewrite bullets using action + impact format: what you built, how you built it, and the result (performance, scale, time saved).")

    # Remove duplicates while keeping order
    seen = set()
    final_recs = []
    for r in recs:
        if r not in seen:
            seen.add(r)
            final_recs.append(r)

    return final_recs[:6]  # keep it concise


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(
    resume: UploadFile = File(...),
    job_description: str = Form("")
):
    """
    AI v1:
    1) Extract resume text from PDF
    2) Compute embedding similarity between resume & JD
    3) Return match score + keyword gaps
    """
    pdf_bytes = await resume.read()
    resume_text_raw = extract_text_from_pdf_bytes(pdf_bytes)

    resume_text = clean_text(resume_text_raw)
    jd_text = clean_text(job_description)

    if not resume_text:
        return {"error": "Could not extract text from the resume PDF. Try a different PDF."}

    if not jd_text:
        return {"error": "Job description is empty. Please paste a job description."}

    # Embeddings + cosine similarity
    emb = embedding_model.encode([resume_text, jd_text])
    sim = float(cosine_similarity([emb[0]], [emb[1]])[0][0])  # -1..1 but usually 0..1 for these
    score = round(max(0.0, min(1.0, sim)) * 100, 1)

    jd_skills = extract_skills(jd_text)
    resume_skills = set(extract_skills(resume_text))

    present = [s for s in jd_skills if s in resume_skills]
    missing = [s for s in jd_skills if s not in resume_skills]
    recommendations = build_recommendations(score, present, missing)

    return {
    "match_score": score,
    "similarity": round(sim, 4),
    "skills_found_in_jd": jd_skills,
    "skills_present": present,
    "skills_missing": missing,
    "recommendations": recommendations,
    "message": "AI v1.2: semantic match score + skills gap + recommendations generated."
}