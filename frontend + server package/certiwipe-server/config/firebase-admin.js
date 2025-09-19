const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = {
    "type": "service_account",
    "project_id": "zerotrace-ef3f5",
    "private_key_id": "b72351921d5ef7c15d05cfa56d091c146345aa10",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCX/A+6xir6ueWn\nqL6w/YU4IXK7WQ1Hbntk22ggpo+VrqJs1QY1v4UxV0eWefeKn/Kw/xudjT+HUcXD\nQLTpJpoBRn0ZVIiNJTXR1VQ++83fqMvW1jBt2vLj4Di3iZdbE9dk/QdA1aTo2F9S\nhj9q/MZZ3sHAvDuQLw5wmSkxKXx9xpV/F45pNSoorsxAV/IZbq1Ec0y9wq6nwWu4\nRqj1trjQoms2Yts6MMPrpFtTHEaUToi/FyRVRJprkpue5xMxTU42qIoBbRW60pe8\nWZKnGxEGkMjxr8qawu6N/2Fimejnk4vJTqnwOMj4+6+/f3HxKjn66E81gyBH7NGS\nvCj2VbDRAgMBAAECggEAEdyHpLWhW3H5cWi9cGN7Aou7xhTDIL/1NHcsl5m7iiXJ\n5OxsHGjzqEbPnPmcg+gkR3TTtAJjku2jRj0WhcgJlVjJXu62VZAn8Q8XJYfGPCDE\nQ+1MJ7zxiqJRSBCdfxCn4bBy58Wz6cF0AmjQjyxBy1IIhzQX8+vz0HvPgX2Uqds8\nXVz4lRtaJstXqmS3C1edNydAIHsJenkBHJj8m4ItQJKE8/CbEnZl4PyWIRtK00x2\nzl5Q+JoUtJtQoICaDMdME8H4zaz6fR4Pxny0Mf9wwBsaWDZr5RinRc6QFKcC0Z59\n4qRNgmeWUyuKqiyf/8JcEY9y8R+25YLh/j6tkm8leQKBgQDGShjg0E8ihbSaLVGd\nfX1V6gS8HrLAUjbZTBfVd1bUcd+g0tCRvT5guePelXPnvKXT2jWx78FhAfXdJaR/\nJISPghFy5VVGPRF2wfpNhh5bt2E0pkUbyAhQ84+wRTI9iQnyvjqZpjo6UMrUMzD+\nTYe8JsAUcAtICzjq8UvM7uE0awKBgQDEN/EeZ6RPOgc1rD1kOqqGhp+D7u2Qa2Vb\n7OCtL9cPBePHUNb9Z1wSx07Xn8M6qOIje5yIb6YDrUjPXV2dpKM5UawC+qmnZyJa\nmDy/BeB/WH9V9m9EJRMmVGA05ZhY+/nkhcmJ6sORjokTut0JmMmEz7giSf/8wiC9\nLa50UoyeswKBgQCh0Zhp5zWde7X+WFuRhfaB5X/Fsdu4fZ+LR8DvkPuIVgHk8gYJ\n2YGNWEZwwFCdXmOJ9zr4oiuTKhFmTzDmHXwczU3GEQe9UVruKrFFEN23hXjLiaE+\nYcj/nzS06lNsymgW9E1IVNKSAprz/27NKaJK1ujMBP//5ECn4xE0BgI9TwKBgBag\n9PeysCpK4OX5tSLH+T6GbAMFHPSYzhmp2cdfSwf6f+hOlFyo/N9ViOwpCpTLQTki\nWk0JwzWNWGZBuDgj8ob7ukCls8cQh8+22tqUzO0iwZyiTPao5+p1tJqlF8q7VHhc\nTX/QSTmSHJDf7fnbWvIsGmop6pG1uZzXldToaDstAoGBAMF97M0EFCIaYIcxhbmY\nhmKFmUukHJqo3Siekv8czrqgVbZ+yv3Cap0yDUs3HJnGVMRS1an6DzKlNlQ7M+Dm\ntzGCWj9m5xHT0gEggdw3uUyuFYsgsqozTghkXpKxIw1NlXSiZ9tcAD/pD4LlZ1rO\n+1InDIYzNphO/y86CrA6BiFA\n-----END PRIVATE KEY-----\n",
    "client_email": "firebase-adminsdk-fbsvc@zerotrace-ef3f5.iam.gserviceaccount.com",
    "client_id": "115274263439457984605",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token", 
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40zerotrace-ef3f5.iam.gserviceaccount.com",
    "universe_domain": "googleapis.com"
};

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin SDK initialized successfully');
} catch (error) {
    console.error('🔥 Error initializing Firebase Admin SDK:', error);
    process.exit(1);
}

module.exports = admin;