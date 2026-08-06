# Payment QR code images

Drop each payment QR screenshot here. Files placed in `public/` are served
from the site root, so:

    public/qr/mrunal-gpay.png   →   https://<your-site>/qr/mrunal-gpay.png

## How to wire one up

1. Save the QR image here with a clear name, e.g. `srikanta-phonepe.png`.
2. In the backend env `PAYMENT_METHODS`, set that method's `qr` to the path:

       { "label": "PhonePe - Srikanta", "upiId": "swapnapatra.sri@ybl",
         "payeeName": "J Srikanta Patro", "phone": "9876543210",
         "qr": "/qr/srikanta-phonepe.png" }

3. Commit the image (it deploys with the frontend).
4. In the Admin dashboard "Payment QR codes" panel, toggle it Published.

The filename does NOT need to match the label — the link is the `qr` path.
Keep names clear just so you don't point a method at the wrong image.

Recommended: square PNG/JPG, ~500x500px, under ~300 KB.
