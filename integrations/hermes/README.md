# Integración Hermes Agent con Expenses API

Este directorio provee los artefactos necesarios para integrar el agente autónomo **Hermes** con la API de finanzas personales.

## Archivos incluidos

1. **`expenses_tool.py`**:
   - Implementación en Python de la Tool para Hermes.
   - Funciones exportadas:
     - `register_expense(...)`: registra comprobantes OCR, mensajes de texto ("gasté 60k en 3 cuotas cada 2 meses...") y SMS bancarios.
     - `get_installments_summary(month)`: consulta las cuotas a pagar en un mes determinado discriminando por tarjeta y titular/adicional.
     - `list_credit_cards()`: lista el catálogo de tarjetas activas para facilitar el matching fonético o difuso en lenguaje natural.

2. **`hermes-config.example.yaml`**:
   - Archivo de configuración modelo para el repositorio privado `hermes-config`.
   - Conecta con el LLM Gateway LiteLLM (`gemini/gemini-3.8-flash` con fallback a OpenRouter Free).

## Instalación en Hermes

Para utilizar esta tool en tu agente Hermes:
1. Copiá `expenses_tool.py` a la carpeta `tools/` de tu repositorio de Hermes (`hermes-config/tools/expenses_tool.py`).
2. Configurá la variable de entorno `EXPENSES_API_URL` apuntando a tu instancia de NestJS (por defecto `http://192.168.68.57:3000/api`).
3. Declarala en tu `config.yaml` de Hermes.
