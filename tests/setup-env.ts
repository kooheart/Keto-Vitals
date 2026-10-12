process.env.BCRYPT_COST = "4"; // fast hashing in tests
process.env.APP_URL = "http://localhost:3000";
process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
process.env.CRON_SECRET = "test-cron";
delete process.env.SMTP_HOST;
