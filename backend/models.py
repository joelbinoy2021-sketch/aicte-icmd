"""
Pydantic Models for ICMD API
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class CaseCreate(BaseModel):
    aicte_permanent_id: str = Field(..., description="Permanent AICTE Institution ID e.g. 1-332456711")
    institution_name: str
    state: str
    region: str
    city: str
    bureau: str = Field(..., description="Handling bureau: Regulation Bureau (RB), Public Grievance Redressal Cell (PGRC), or Regional Office (RO)")
    assigned_officer: str
    officer_designation: str
    officer_email: str
    complainant_name: str
    complainant_type: str = Field(..., description="Student, Faculty, Parent, Whistleblower / Citizen, RTI Applicant")
    complainant_email: Optional[str] = None
    complainant_phone: Optional[str] = None
    subject: str
    description: str
    category: str
    priority: str = "Normal"
    sla_days: int = 30

class CaseAction(BaseModel):
    action: str = Field(..., description="e.g. Officer Reassigned, Show Cause Notice Issued, Escalated, Disposed, Transferred")
    officer_name: str
    bureau: str
    remarks: str
    doc_name: Optional[str] = None
    new_status: Optional[str] = None

class OverlapLinkRequest(BaseModel):
    case_id_a: str
    case_id_b: str
    lead_bureau: str
    strategy_notes: str
    officer_name: str
    bureau: str

class OverlapDismissRequest(BaseModel):
    case_id_a: str
    case_id_b: str
    officer_name: str
    dismiss_reason: str

class OverlapCheckRequest(BaseModel):
    aicte_permanent_id: Optional[str] = ""
    institution_name: Optional[str] = ""
    city: Optional[str] = ""
    state: Optional[str] = ""
    subject: Optional[str] = ""
    description: Optional[str] = ""
    current_case_id: Optional[str] = None
