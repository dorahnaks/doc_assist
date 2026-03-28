from groq import Groq
import PyPDF2
import docx
import json
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status


def extract_text_from_pdf(file):
    try:
        reader = PyPDF2.PdfReader(file)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        raise ValueError(f"Could not read PDF file: {str(e)}")


def extract_text_from_docx(file):
    try:
        document = docx.Document(file)
        text = ""
        for paragraph in document.paragraphs:
            text += paragraph.text + "\n"
        return text.strip()
    except Exception as e:
        raise ValueError(f"Could not read Word file: {str(e)}")


def analyze_with_groq(text):
    client = Groq(api_key=settings.GROQ_API_KEY)

    prompt = f"""
You are a professional document analyst. Respond ONLY with a valid JSON object. No markdown, no backticks, no extra text.

Return this exact JSON structure:
{{
  "title": "document title",
  "author": "author name or Not mentioned",
  "document_type": "type of document",
  "summary": "Three paragraphs separated by \\n\\n. First paragraph: purpose and overview. Second paragraph: main content and findings. Third paragraph: conclusions.",
  "main_points": ["point 1", "point 2", "point 3", "point 4", "point 5"],
  "key_terms": ["term 1", "term 2", "term 3", "term 4", "term 5"],
  "conclusion": "2-3 sentence final takeaway"
}}

Keep each main point under 20 words. Keep each key term under 4 words.

Document:
{text[:8000]}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": "You are a document analyst. Respond with valid JSON only. No markdown. No backticks. No extra text before or after the JSON."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        temperature=0.1,
        max_tokens=1500,
    )

    raw = response.choices[0].message.content.strip()

    # Remove markdown code fences if present
    if "```json" in raw:
        raw = raw.split("```json")[1].split("```")[0].strip()
    elif "```" in raw:
        raw = raw.split("```")[1].split("```")[0].strip()

    # Extract JSON object
    start = raw.find('{')
    end = raw.rfind('}')
    if start != -1 and end != -1:
        raw = raw[start:end+1]

    return json.loads(raw)


@api_view(['POST'])
def analyze_document(request):
    if 'file' not in request.FILES:
        return Response(
            {'error': 'No file uploaded. Please upload a PDF or Word file.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    uploaded_file = request.FILES['file']
    filename = uploaded_file.name.lower()

    if not (filename.endswith('.pdf') or filename.endswith('.docx') or filename.endswith('.doc')):
        return Response(
            {'error': 'Invalid file type. Please upload a PDF (.pdf) or Word (.docx) file.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    if uploaded_file.size > 10 * 1024 * 1024:
        return Response(
            {'error': 'File too large. Maximum size is 10MB.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        if filename.endswith('.pdf'):
            text = extract_text_from_pdf(uploaded_file)
        else:
            text = extract_text_from_docx(uploaded_file)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    if not text or len(text) < 50:
        return Response(
            {'error': 'Could not extract enough text from this document.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        result = analyze_with_groq(text)
    except json.JSONDecodeError:
        return Response(
            {'error': 'AI could not parse the document. Please try again.'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    except Exception as e:
        return Response(
            {'error': f'AI analysis failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return Response({
        'success': True,
        'filename': uploaded_file.name,
        'word_count': len(text.split()),
        'result': result
    })