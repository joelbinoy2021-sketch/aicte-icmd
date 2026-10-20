"""
ICMD Overlap Detection Engine
Combines deterministic rules (AICTE Permanent ID) with fuzzy string matching
(RapidFuzz) and semantic/lexical similarity for complaint descriptions.
"""
import re
from typing import List, Dict, Any, Tuple
from rapidfuzz import fuzz

# Common stop words for regulatory/complaint domain to clean text for similarity
DOMAIN_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "to", "for", "in", "on", "at",
    "by", "with", "from", "and", "or", "of", "about", "aicte", "college", "institute",
    "institution", "against", "complaint", "regarding", "respect", "ref", "dated", "matter"
}

def clean_text(text: str) -> str:
    """Normalize text by lowercasing, removing punctuation and common fillers."""
    if not text:
        return ""
    text = text.lower()
    text = re.sub(r'[^a-z0-9\s]', ' ', text)
    words = [w for w in text.split() if len(w) > 2 and w not in DOMAIN_STOPWORDS]
    return " ".join(words)

def compute_overlap_score(target_case: Dict[str, Any], candidate_case: Dict[str, Any]) -> Tuple[float, List[str]]:
    """
    Computes an overlap confidence score (0 to 100) between two cases.
    Returns (score, list_of_reasons).
    """
    # Don't match against self
    if str(target_case.get("id")) == str(candidate_case.get("id")) or str(target_case.get("case_id")) == str(candidate_case.get("case_id")):
        return 0.0, []

    reasons = []
    
    # 1. AICTE Permanent ID Match (Hard check)
    target_pid = (target_case.get("aicte_permanent_id") or "").strip().upper()
    cand_pid = (candidate_case.get("aicte_permanent_id") or "").strip().upper()
    
    id_matched = False
    if target_pid and cand_pid and target_pid == cand_pid:
        id_matched = True
        reasons.append(f"Identical AICTE Permanent ID ({target_pid})")

    # 2. Institution Name Similarity (Fuzzy)
    target_name = (target_case.get("institution_name") or "").strip()
    cand_name = (candidate_case.get("institution_name") or "").strip()
    name_score = fuzz.token_sort_ratio(target_name.lower(), cand_name.lower())
    
    if name_score >= 85 and not id_matched:
        reasons.append(f"High institution name similarity ({name_score:.0f}%)")

    # 3. Location / City / State Similarity
    target_loc = f"{target_case.get('city', '')} {target_case.get('state', '')}".lower().strip()
    cand_loc = f"{candidate_case.get('city', '')} {candidate_case.get('state', '')}".lower().strip()
    loc_score = fuzz.token_set_ratio(target_loc, cand_loc) if (target_loc and cand_loc) else 50.0

    # 4. Complaint Text / Subject Similarity (Lexical Token Set Match)
    target_subj = f"{target_case.get('subject', '')} {target_case.get('description', '')}"
    cand_subj = f"{candidate_case.get('subject', '')} {candidate_case.get('description', '')}"
    
    cleaned_target = clean_text(target_subj)
    cleaned_cand = clean_text(cand_subj)
    
    text_token_score = fuzz.token_set_ratio(cleaned_target, cleaned_cand) if (cleaned_target and cleaned_cand) else 0.0
    
    # Find intersecting key grievance topics
    t_words = set(cleaned_target.split())
    c_words = set(cleaned_cand.split())
    common_keywords = list(t_words.intersection(c_words))
    if len(common_keywords) >= 3:
        top_keywords = ", ".join(common_keywords[:4])
        reasons.append(f"Co-occurring complaint keywords: '{top_keywords}'")

    # Calculate Composite Confidence Score
    if id_matched:
        # Same institution across different cases
        # Base confidence is 80%, scaled up with description similarity
        score = 80.0 + (text_token_score * 0.20)
        # Note if cases belong to different bureaus
        if target_case.get("bureau") != candidate_case.get("bureau"):
            reasons.append(f"Cross-Bureau Case: Handled concurrently by {candidate_case.get('bureau')}")
    else:
        # No exact permanent ID match - relies on fuzzy name, location and text
        score = (name_score * 0.55) + (loc_score * 0.20) + (text_token_score * 0.25)
        if name_score >= 90:
            reasons.append("Probable unlinked branch or name alias")

    score = round(min(100.0, max(0.0, score)), 1)
    return score, reasons

def scan_for_overlaps(new_or_target_case: Dict[str, Any], all_cases: List[Dict[str, Any]], threshold: float = 65.0) -> List[Dict[str, Any]]:
    """
    Scans candidate cases and returns matches meeting or exceeding the overlap threshold.
    """
    matches = []
    for cand in all_cases:
        # Skip if already closed/disposed unless explicitly checking historical
        score, reasons = compute_overlap_score(new_or_target_case, cand)
        if score >= threshold:
            severity = "CRITICAL" if score >= 85 else ("HIGH" if score >= 75 else "MEDIUM")
            matches.append({
                "candidate_case_id": cand.get("case_id"),
                "candidate_id": cand.get("id"),
                "institution_name": cand.get("institution_name"),
                "aicte_permanent_id": cand.get("aicte_permanent_id"),
                "bureau": cand.get("bureau"),
                "assigned_officer": cand.get("assigned_officer"),
                "officer_designation": cand.get("officer_designation"),
                "status": cand.get("status"),
                "subject": cand.get("subject"),
                "filing_date": cand.get("filing_date"),
                "overlap_score": score,
                "severity": severity,
                "reasons": reasons
            })
            
    matches.sort(key=lambda m: m["overlap_score"], reverse=True)
    return matches
