import os
import io
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['UPLOAD_FOLDER'] = 'tests/uploads'
    app.config['PROCESSED_FOLDER'] = 'tests/processed'
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)
    with app.test_client() as client:
        yield client
    # Cleanup after tests
    import time
    for folder in [app.config['UPLOAD_FOLDER'], app.config['PROCESSED_FOLDER']]:
        for filename in os.listdir(folder):
            file_path = os.path.join(folder, filename)
            if os.path.isfile(file_path):
                try:
                    os.remove(file_path)
                except PermissionError:
                    time.sleep(0.1)
                    try:
                        os.remove(file_path)
                    except PermissionError:
                        pass

def test_index(client):
    rv = client.get('/')
    assert rv.status_code == 200
    assert b"<html" in rv.data.lower()

def test_summarize_text(client):
    rv = client.post('/summarize', data={'text': 'This is a test text for summarization.'})
    assert rv.status_code == 200
    assert b"summary" in rv.data.lower() or b"summary" in rv.data.decode('utf-8').lower()

def test_summarize_invalid_file(client):
    data = {
        'file': (io.BytesIO(b"fake content"), 'test.txt')
    }
    rv = client.post('/summarize', data=data, content_type='multipart/form-data', follow_redirects=True)
    assert b'Unsupported file type' in rv.data or b'Please provide text or upload a document' in rv.data

import os

def test_merge_pdfs(client):
    # Use existing PDF files from tests/uploads folder for testing merge
    base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    file1_path = os.path.join(base_path, 'tests', 'uploads', 'Assignment.pdf')
    file2_path = os.path.join(base_path, 'tests', 'uploads', 'PEPAR_3.pdf')
    with open(file1_path, 'rb') as f1, open(file2_path, 'rb') as f2:
        data = {
            'files': [
                (f1, 'Assignment.pdf'),
                (f2, 'PEPAR_3.pdf')
            ]
        }
        rv = client.post('/merge', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert rv.status_code in (200, 302)

def test_pdf_to_word_no_file(client):
    rv = client.post('/pdf-to-word', data={}, follow_redirects=True)
    assert b'No file selected' in rv.data

def test_word_to_pdf_invalid_file(client):
    data = {
        'file': (io.BytesIO(b"not a word file"), 'test.txt')
    }
    rv = client.post('/word-to-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
    assert b'Please select a valid Word document' in rv.data

def test_pdf_to_ppt_no_file(client):
    rv = client.post('/pdf-to-ppt', data={}, follow_redirects=True)
    assert b'No file selected' in rv.data

def test_image_to_text_no_file(client):
    rv = client.post('/image-to-text', data={}, follow_redirects=True)
    assert b'No image file selected' in rv.data

def test_pdf_editor_no_file(client):
    rv = client.post('/pdf-editor', data={}, follow_redirects=True)
    assert b'No file selected' in rv.data

def test_add_watermark_no_file(client):
    rv = client.post('/add-watermark', data={}, follow_redirects=True)
    assert b'Please select a PDF file.' in rv.data or b'Please select both PDF and watermark files' in rv.data

def test_rotate_pdf_invalid_rotation(client):
    pdf = io.BytesIO(b'%PDF-1.4 test pdf')
    data = {
        'file': (pdf, 'test.pdf'),
        'angle': '45'
    }
    rv = client.post('/rotate-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
    assert b'Rotation must be 0, 90, 180, or 270 degrees' in rv.data

def test_protect_pdf_no_password(client):
    pdf = io.BytesIO(b'%PDF-1.4 test pdf')
    data = {
        'file': (pdf, 'test.pdf'),
        'password': ''
    }
    rv = client.post('/protect-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
    assert b'Please enter a password' in rv.data

def test_unlock_pdf_no_file(client):
    rv = client.post('/unlock-pdf', data={}, follow_redirects=True)
    assert b'No file selected' in rv.data

def test_organize_pdf_invalid_order(client):
    pdf = io.BytesIO(b'%PDF-1.4 test pdf')
    data = {
        'file': (pdf, 'test.pdf'),
        'page_order': 'a,b,c'
    }
    rv = client.post('/organize-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
    assert b'Invalid page order format' in rv.data

def test_delete_pages_no_file(client):
    rv = client.post('/delete-pages', data={}, follow_redirects=True)
    assert b'No file selected' in rv.data

def test_download_file_not_found(client):
    rv = client.get('/download/nonexistent.pdf')
    assert rv.status_code == 404 or rv.status_code == 200
