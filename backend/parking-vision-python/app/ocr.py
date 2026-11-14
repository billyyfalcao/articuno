"""Raw OCR and Brazilian syntax validation are deliberately separate."""
import re

import cv2
import pytesseract


def classify(raw_text: str, confidence: float, threshold: float) -> dict:
    # Never substitute lookalikes (O/0, I/1) or remove arbitrary punctuation.
    normalized = re.sub(r'[\s-]', '', raw_text.upper())
    valid = bool(re.fullmatch(r'[A-Z]{3}(?:[0-9]{4}|[0-9][A-Z][0-9]{2})', normalized))
    if not raw_text.strip():
        reason = 'no_text'
    elif not valid:
        reason = 'invalid_brazilian_format'
    elif confidence < threshold:
        reason = 'low_confidence'
    else:
        reason = 'confirmation_required'
    return dict(raw_text=raw_text, normalized_text=normalized,
                confidence=confidence, valid_brazilian_format=valid,
                rejection_reason=reason, automatic_event_allowed=False)


class PlateReader:
    def __init__(self, executable: str = 'tesseract', threshold: float = .8):
        self.executable = executable
        self.threshold = threshold

    def read(self, frame, roi=None):
        x, y, width, height = roi or (0, 0, frame.shape[1], frame.shape[0])
        if x + width > frame.shape[1] or y + height > frame.shape[0]:
            raise ValueError('ROI outside frame')
        crop = frame[y:y + height, x:x + width]
        pytesseract.pytesseract.tesseract_cmd = self.executable
        data = pytesseract.image_to_data(
            cv2.cvtColor(crop, cv2.COLOR_BGR2RGB),
            config='--psm 6' if roi else '--psm 11', lang='eng',
            output_type=pytesseract.Output.DICT, timeout=10,
        )
        lines = {}
        for i, text in enumerate(data['text']):
            if not text.strip() or float(data['conf'][i]) < 0:
                continue
            key = tuple(data[k][i] for k in ('page_num', 'block_num', 'par_num', 'line_num'))
            lines.setdefault(key, []).append(i)
        results = []
        for indices in lines.values():
            raw = ' '.join(data['text'][i] for i in indices)
            confidence = min(float(data['conf'][i]) for i in indices) / 100
            left = min(data['left'][i] for i in indices)
            top = min(data['top'][i] for i in indices)
            right = max(data['left'][i] + data['width'][i] for i in indices)
            bottom = max(data['top'][i] + data['height'][i] for i in indices)
            results.append(dict(**classify(raw, confidence, self.threshold),
                                bounding_box=[x + left, y + top, right - left, bottom - top]))
        return results or [dict(**classify('', 0, self.threshold), bounding_box=None)]
