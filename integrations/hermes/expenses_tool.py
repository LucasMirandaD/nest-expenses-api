#!/usr/bin/env python3
"""
Expenses Integration Tool for Hermes Agent.
Allows Hermes to interact with the NestJS Expenses API to:
  1. register_expense: register OCR, chat or SMS expenses with installments & card info.
  2. get_installments_summary: query upcoming credit card installments by month.
  3. list_credit_cards: check available cards and extension holders.
"""

import os
import json
import urllib.request
import urllib.error
from typing import Optional, Dict, Any

API_BASE_URL = os.getenv("EXPENSES_API_URL", "http://192.168.68.57:3000/api")

def _make_request(endpoint: str, method: str = "GET", data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    url = f"{API_BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    
    req_data = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_body = response.read().decode("utf-8")
            return json.loads(res_body) if res_body else {"status": "ok"}
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        return {
            "error": True,
            "status_code": e.code,
            "message": error_body or str(e)
        }
    except Exception as e:
        return {
            "error": True,
            "message": f"Connection error: {str(e)}"
        }

def register_expense(
    merchant_name: str,
    description: str,
    total_amount: float,
    expense_date: str,
    currency: str = "ARS",
    payment_method: str = "CREDIT_CARD",
    card_bank: Optional[str] = None,
    card_name: Optional[str] = None,
    card_holder: Optional[str] = None,
    is_installment: bool = False,
    total_installments: int = 1,
    interval_months: int = 1,
    first_due_date: Optional[str] = None,
    category: str = "GENERAL",
    source: str = "CHAT_MESSAGE",
    raw_source_text: Optional[str] = None,
    paperless_document_id: Optional[int] = None
) -> str:
    """
    Registers a new expense in the database with optional credit card installment plan.
    """
    payload = {
        "merchantName": merchant_name,
        "description": description,
        "totalAmount": float(total_amount),
        "currency": currency,
        "expenseDate": expense_date,
        "paymentMethod": payment_method,
        "cardBank": card_bank,
        "cardName": card_name,
        "cardHolder": card_holder,
        "isInstallment": is_installment or total_installments > 1,
        "totalInstallments": int(total_installments),
        "intervalMonths": int(interval_months),
        "firstDueDate": first_due_date,
        "category": category,
        "source": source,
        "rawSourceText": raw_source_text,
        "paperlessDocumentId": paperless_document_id
    }
    # Clean None values
    payload = {k: v for k, v in payload.items() if v is not None}
    
    result = _make_request("/expenses", method="POST", data=payload)
    if result.get("error"):
        return f"❌ Error registrando gasto: {result.get('message')}"
    
    res_str = f"✅ Gasto registrado con éxito (ID: {result.get('id')}).\n"
    res_str += f"- Comercio: {result.get('merchantName')}\n"
    res_str += f"- Monto: ${result.get('totalAmount')} {result.get('currency')}\n"
    
    card = result.get("creditCard")
    if card:
        extension_tag = " (Extensión: " + card['holderName'] + ")" if card.get("isExtension") else " (Titular)"
        res_str += f"- Tarjeta: {card.get('bank')} {card.get('cardName')}{extension_tag}\n"
        
    installments = result.get("installments")
    if installments and len(installments) > 1:
        res_str += f"- Plan: {len(installments)} cuotas (intervalo: {result.get('intervalMonths')} mes/es):\n"
        for inst in installments:
            res_str += f"   * Cuota {inst['installmentNumber']}/{inst['totalInstallments']}: ${inst['amount']} - Vto: {inst['dueDate']}\n"
            
    return res_str

def get_installments_summary(month: Optional[str] = None) -> str:
    """
    Queries pending installments for a specific month (YYYY-MM).
    """
    endpoint = f"/expenses/installments/summary"
    if month:
        endpoint += f"?month={month}"
        
    result = _make_request(endpoint, method="GET")
    if result.get("error"):
        return f"❌ Error consultando cuotas: {result.get('message')}"
        
    res_str = f"📅 Resumen de cuotas para el mes {result.get('month')}:\n"
    res_str += f"- Total a pagar: ${result.get('totalAmountDue'):,.2f}\n"
    res_str += f"- Cantidad de cuotas: {result.get('installmentsCount')}\n\n"
    
    items = result.get("items", [])
    if not items:
        res_str += "No hay cuotas registradas para este período."
        return res_str
        
    for item in items:
        card_desc = f"{item.get('cardBank', '')} {item.get('cardName', '')}".strip()
        holder_desc = f" ({item.get('holderName')})" if item.get('holderName') else ""
        res_str += f"• {item.get('merchantName')} - {item.get('description')}: ${item.get('amount'):,.2f} (Cuota {item.get('installmentNumber')}/{item.get('totalInstallments')}) | Vto: {item.get('dueDate')} | Tarjeta: {card_desc}{holder_desc}\n"
        
    return res_str

def list_credit_cards() -> str:
    """
    Lists all available credit cards and extensions.
    """
    result = _make_request("/expenses/cards", method="GET")
    if isinstance(result, dict) and result.get("error"):
        return f"❌ Error obteniendo tarjetas: {result.get('message')}"
        
    cards = result if isinstance(result, list) else []
    if not cards:
        return "No hay tarjetas registradas en el sistema."
        
    res_str = "💳 Tarjetas registradas:\n"
    for card in cards:
        tipo = "Adicional / Extensión" if card.get("isExtension") else "Titular"
        res_str += f"- {card.get('bank')} {card.get('cardName')} | {tipo}: {card.get('holderName')} (Cierre: día {card.get('closingDay', 'N/D')}, Vto: día {card.get('dueDay', 'N/D')})\n"
        
    return res_str
