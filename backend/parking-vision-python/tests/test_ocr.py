import os
import shutil

import cv2
import numpy as np
import pytest

from app.ocr import PlateReader, classify


@pytest.mark.parametrize('raw,valid,reason', [
    ('abc-1234', True, 'confirmation_required'),
    ('ABC1D23', True, 'confirmation_required'),
    ('GX15 OCJ', False, 'invalid_brazilian_format'),
    ('ABC!1234', False, 'invalid_brazilian_format'),
    ('AB01234', False, 'invalid_brazilian_format'),
    ('', False, 'no_text'),
])
def test_separate_validation(raw, valid, reason):
    result = classify(raw, .95, .8)
    assert result['raw_text'] == raw
    assert result['valid_brazilian_format'] is valid
    assert result['rejection_reason'] == reason
    assert result['automatic_event_allowed'] is False


def test_low_confidence():
    assert classify('ABC1234', .3, .8)['rejection_reason'] == 'low_confidence'


@pytest.mark.parametrize('text', ['ABC1234', 'ABC1D23'])
def test_real_engine_synthetic_brazilian_format(text):
    executable = os.getenv('TESSERACT_CMD') or shutil.which('tesseract')
    if not executable:
        pytest.skip('Set TESSERACT_CMD to run the real OCR engine')
    # Original synthetic artwork generated here; not a photograph or observed plate.
    image = np.full((160, 650, 3), 255, dtype=np.uint8)
    cv2.putText(image, text, (30, 110), cv2.FONT_HERSHEY_SIMPLEX, 3, (0, 0, 0), 5)
    results = PlateReader(executable).read(image, [0, 0, 650, 160])
    assert any(r['normalized_text'] == text and r['valid_brazilian_format'] for r in results)
    assert all(not r['automatic_event_allowed'] for r in results)
