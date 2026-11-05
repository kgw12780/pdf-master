import os
import io
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from app import app

@pytest.fixture
def client():
    app.config['TESTING'] = True
    client = app.test_client()
    yield client

base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sample_pdf_path = os.path.join(base_path, 'tests', 'uploads', 'sample1.pdf')

def test_merge_pdfs(client):
    file1_path = sample_pdf_path
    file2_path = sample_pdf_path
    with open(file1_path, 'rb') as f1, open(file2_path, 'rb') as f2:
        data = {
            'files': [
                (f1, 'sample1.pdf'),
                (f2, 'sample2.pdf')
            ]
        }
        response = client.post('/merge', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_pdf_to_word(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf')}
        response = client.post('/pdf-to-word', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_word_to_pdf(client):
    # This test requires a valid Word file, skipping for now or can be added if sample docx is available
    pass

def test_split_pdf(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf'), 'start_page': '1', 'end_page': '1'}
        response = client.post('/split-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_compress_pdf(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf')}
        response = client.post('/compress-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_pdf_to_ppt(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf')}
        response = client.post('/pdf-to-ppt', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_excel_to_pdf(client):
    # This test requires a valid Excel file, skipping for now or can be added if sample xlsx is available
    pass

def test_pdf_editor(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf'), 'text': 'Test Text', 'x': '100', 'y': '100'}
        response = client.post('/pdf-editor', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_pdf_to_jpg(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf')}
        response = client.post('/pdf-to-jpg', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_jpg_to_pdf(client):
    # This test requires valid image files, skipping for now or can be added if sample images are available
    pass

def test_add_watermark(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf'), 'watermark_text': 'CONFIDENTIAL'}
        response = client.post('/add-watermark', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_rotate_pdf(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf'), 'angle': '90'}
        response = client.post('/rotate-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_protect_pdf(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf'), 'password': 'test123'}
        response = client.post('/protect-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_unlock_pdf(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf'), 'password': ''}
        response = client.post('/unlock-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_organize_pdf(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf'), 'page_order': '1'}
        response = client.post('/organize-pdf', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200

def test_delete_pages(client):
    with open(sample_pdf_path, 'rb') as f:
        data = {'file': (f, 'sample.pdf'), 'pages_to_delete': '1'}
        response = client.post('/delete-pages', data=data, content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 302 or response.status_code == 200
