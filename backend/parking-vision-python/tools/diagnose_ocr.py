"""Reproduce manual-ROI experiments; never correct or select OCR text by format.

Run from the service directory with its venv Python. Output contains plate text;
keep the output and input media local unless publication is authorized.
"""
import argparse
import json

import cv2
import pytesseract


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('video')
    parser.add_argument('--tesseract', default='tesseract')
    parser.add_argument('--frame', type=int, required=True)
    parser.add_argument('--roi', nargs=4, type=int, required=True, metavar=('X', 'Y', 'W', 'H'))
    args = parser.parse_args()
    pytesseract.pytesseract.tesseract_cmd = args.tesseract
    capture = cv2.VideoCapture(args.video)
    try:
        if not capture.isOpened():
            parser.error('Cannot open video')
        capture.set(cv2.CAP_PROP_POS_FRAMES, args.frame)
        ok, frame = capture.read()
        if not ok:
            parser.error('Cannot read requested frame')
    finally:
        capture.release()
    x, y, w, h = args.roi
    if min(x, y, args.frame) < 0 or min(w, h) <= 0 or x+w > frame.shape[1] or y+h > frame.shape[0]:
        parser.error('Invalid frame or ROI')
    crop = frame[y:y+h, x:x+w]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    scaled = cv2.resize(gray, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    variants = {
        'original': cv2.cvtColor(crop, cv2.COLOR_BGR2RGB),
        'gray': gray,
        'gray_3x': scaled,
        'otsu_3x': cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1],
        'clahe_3x': cv2.createCLAHE(2, (4, 4)).apply(scaled),
    }
    for name, image in variants.items():
        for psm in (6, 7, 13):
            data = pytesseract.image_to_data(image, lang='eng', config=f'--psm {psm}',
                                            output_type=pytesseract.Output.DICT, timeout=10)
            tokens = [(text, float(conf)/100) for text, conf in zip(data['text'], data['conf']) if text.strip()]
            print(json.dumps(dict(frame=args.frame, frame_size=[frame.shape[1], frame.shape[0]],
                                  roi=args.roi, preprocessing=name, psm=psm, tokens=tokens), ensure_ascii=False))


if __name__ == '__main__':
    main()
