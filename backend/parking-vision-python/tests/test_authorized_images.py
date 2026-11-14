"""Opt-in real photographs; no private images enter the repository."""
import json
import os
from pathlib import Path

import cv2
import pytest

from app.ocr import PlateReader


def test_authorized_brazilian_photos():
    manifest = os.getenv('OCR_AUTHORIZED_MANIFEST')
    if not manifest:
        pytest.skip('Real Brazilian photographs not supplied; set OCR_AUTHORIZED_MANIFEST')
    path = Path(manifest)
    samples = json.loads(path.read_text(encoding='utf-8'))
    assert samples, 'Manifest must contain authorized samples'
    reader = PlateReader(os.getenv('TESSERACT_CMD', 'tesseract'))
    for sample in samples:
        assert sample['authorized'] is True
        image = cv2.imread(str(path.parent / sample['file']))
        assert image is not None
        results = reader.read(image, sample.get('roi'))
        assert any(r['normalized_text'] == sample['expected'] and
                   r['valid_brazilian_format'] for r in results), results
