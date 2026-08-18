import 'dotenv/config';

process.env.STRIPE_SECRET_KEY ??= 'sk_test_dummy';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_dummy';
process.env.STRIPE_PRICE_ID_PRO ??= 'price_dummy';
