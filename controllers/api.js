const { promisify } = require('util');
const cheerio = require('cheerio');
const GitHub = require('@octokit/rest');
const Twit = require('twit');
const stripe = require('stripe')(process.env.STRIPE_SKEY);
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const paypal = require('paypal-rest-sdk');
const lob = require('lob')(process.env.LOB_KEY);
const axios = require('axios');
const { google } = require('googleapis');
const validator = require('validator');

/**
 * GET /api
 * List of API examples.
 */
exports.getApi = (req, res) => {
  res.render('api/index', {
    title: 'API Examples'
  });
};


/**
 * GET /api/scraping
 * Web scraping example using Cheerio library.
 */
exports.getScraping = (req, res, next) => {
  axios.get('https://news.ycombinator.com/')
    .then((response) => {
      const $ = cheerio.load(response.data);
      const links = [];
      $('.title a[href^="http"], a[href^="https"]').slice(1).each((index, element) => {
        links.push($(element));
      });
      res.render('api/scraping', {
        title: 'Web Scraping',
        links
      });
    })
    .catch((error) => next(error));
};

/**
 * GET /api/github
 * GitHub API Example.
 */
exports.getGithub = async (req, res, next) => {
  const github = new GitHub();
  try {
    const { data: repo } = await github.repos.get({ owner: 'sahat', repo: 'hackathon-starter' });
    res.render('api/github', {
      title: 'GitHub API',
      repo
    });
  } catch (error) {
    next(error);
  }
};



/**
 * GET /api/twitter
 * Twitter API example.
 */
exports.getTwitter = async (req, res, next) => {
  const token = req.user.tokens.find((token) => token.kind === 'twitter');
  const T = new Twit({
    consumer_key: process.env.TWITTER_KEY,
    consumer_secret: process.env.TWITTER_SECRET,
    access_token: token.accessToken,
    access_token_secret: token.tokenSecret
  });
  try {
    const { data: { statuses: tweets } } = await T.get('search/tweets', {
      q: 'nodejs since:2013-01-01',
      geocode: '40.71448,-74.00598,5mi',
      count: 10
    });
    res.render('api/twitter', {
      title: 'Twitter API',
      tweets
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/twitter
 * Post a tweet.
 */
exports.postTwitter = (req, res, next) => {
  const validationErrors = [];
  if (validator.isEmpty(req.body.tweet)) validationErrors.push({ msg: 'Tweet cannot be empty' });

  if (validationErrors.length) {
    req.flash('errors', validationErrors);
    return res.redirect('/api/twitter');
  }

  const token = req.user.tokens.find((token) => token.kind === 'twitter');
  const T = new Twit({
    consumer_key: process.env.TWITTER_KEY,
    consumer_secret: process.env.TWITTER_SECRET,
    access_token: token.accessToken,
    access_token_secret: token.tokenSecret
  });
  T.post('statuses/update', { status: req.body.tweet }, (err) => {
    if (err) { return next(err); }
    req.flash('success', { msg: 'Your tweet has been posted.' });
    res.redirect('/api/twitter');
  });
};


/**
 * GET /api/stripe
 * Stripe API example.
 */
exports.getStripe = (req, res) => {
  res.render('api/stripe', {
    title: 'Stripe API',
    publishableKey: process.env.STRIPE_PKEY
  });
};

/**
 * POST /api/stripe
 * Make a payment.
 */
exports.postStripe = (req, res) => {
  const { stripeToken, stripeEmail } = req.body;
  stripe.charges.create({
    amount: 395,
    currency: 'usd',
    source: stripeToken,
    description: stripeEmail
  }, (err) => {
    if (err && err.type === 'StripeCardError') {
      req.flash('errors', { msg: 'Your card has been declined.' });
      return res.redirect('/api/stripe');
    }
    req.flash('success', { msg: 'Your card has been successfully charged.' });
    res.redirect('/api/stripe');
  });
};

/**
 * GET /api/twilio
 * Twilio API example.
 */
exports.getTwilio = (req, res) => {
  res.render('api/twilio', {
    title: 'Twilio API'
  });
};

/**
 * POST /api/twilio
 * Send a text message using Twilio.
 */
exports.postTwilio = (req, res, next) => {
  const validationErrors = [];
  if (validator.isEmpty(req.body.number)) validationErrors.push({ msg: 'Phone number is required.' });
  if (validator.isEmpty(req.body.message)) validationErrors.push({ msg: 'Message cannot be blank.' });

  if (validationErrors.length) {
    req.flash('errors', validationErrors);
    return res.redirect('/api/twilio');
  }

  const message = {
    to: req.body.number,
    from: '+13472235148',
    body: req.body.message
  };
  twilio.messages.create(message).then((sentMessage) => {
    req.flash('success', { msg: `Text send to ${sentMessage.to}` });
    res.redirect('/api/twilio');
  }).catch(next);
};
/**
 * GET /api/paypal
 * PayPal SDK example.
 */
exports.getPayPal = (req, res, next) => {
  paypal.configure({
    mode: 'sandbox',
    client_id: process.env.PAYPAL_ID,
    client_secret: process.env.PAYPAL_SECRET
  });

  const paymentDetails = {
    intent: 'sale',
    payer: {
      payment_method: 'paypal'
    },
    redirect_urls: {
      return_url: process.env.PAYPAL_RETURN_URL,
      cancel_url: process.env.PAYPAL_CANCEL_URL
    },
    transactions: [{
      description: 'Hackathon Starter',
      amount: {
        currency: 'USD',
        total: '1.99'
      }
    }]
  };

  paypal.payment.create(paymentDetails, (err, payment) => {
    if (err) { return next(err); }
    const { links, id } = payment;
    req.session.paymentId = id;
    for (let i = 0; i < links.length; i++) {
      if (links[i].rel === 'approval_url') {
        res.render('api/paypal', {
          approvalUrl: links[i].href
        });
      }
    }
  });
};

/**
 * GET /api/paypal/success
 * PayPal SDK example.
 */
exports.getPayPalSuccess = (req, res) => {
  const { paymentId } = req.session;
  const paymentDetails = { payer_id: req.query.PayerID };
  paypal.payment.execute(paymentId, paymentDetails, (err) => {
    res.render('api/paypal', {
      result: true,
      success: !err
    });
  });
};

/**
 * GET /api/paypal/cancel
 * PayPal SDK example.
 */
exports.getPayPalCancel = (req, res) => {
  req.session.paymentId = null;
  res.render('api/paypal', {
    result: true,
    canceled: true
  });
};

/**
 * GET /api/lob
 * Lob API example.
 */
exports.getLob = async (req, res, next) => {
  let recipientName;
  if (req.user) { recipientName = req.user.profile.name; } else { recipientName = 'John Doe'; }
  const addressTo = {
    name: recipientName,
    address_line1: '123 Main Street',
    address_city: 'New York',
    address_state: 'NY',
    address_zip: '94107'
  };
  const addressFrom = {
    name: 'Hackathon Starter',
    address_line1: '123 Test Street',
    address_line2: 'Unit 200',
    address_city: 'Chicago',
    address_state: 'IL',
    address_zip: '60012',
    address_country: 'US'
  };

  const lookupZip = () => lob.usZipLookups.lookup({ zip_code: '94107' })
    .then((zipdetails) => (zipdetails))
    .catch((error) => Promise.reject(new Error(`Could not get zip code details: ${error}`)));

  const createAndMailLetter = () => lob.letters.create({
    description: 'My First Class Letter',
    to: addressTo,
    from: addressFrom,
    // file: minified version of https://github.com/lob/lob-node/blob/master/examples/html/letter.html with slight changes as an example
    file: `<html><head><meta charset="UTF-8"><style>body{width:8.5in;height:11in;margin:0;padding:0}.page{page-break-after:always;position:relative;width:8.5in;height:11in}.page-content{position:absolute;width:8.125in;height:10.625in;left:1in;top:1in}.text{position:relative;left:20px;top:3in;width:6in;font-size:14px}</style></head>
          <body><div class="page"><div class="page-content"><div class="text">
          Hello ${addressTo.name}, <p> We would like to welcome you to the community! Thanks for being a part of the team! <p><p> Cheer,<br>${addressFrom.name}
          </div></div></div></body></html>`,
    color: false
  })
    .then((letter) => (letter))
    .catch((error) => Promise.reject(new Error(`Could not create and send letter: ${error}`)));

  try {
    const uspsLetter = await createAndMailLetter();
    const zipDetails = await lookupZip();
    res.render('api/lob', {
      title: 'Lob API',
      zipDetails,
      uspsLetter,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/upload
 * File Upload API example.
 */

exports.getFileUpload = (req, res) => {
  res.render('api/upload', {
    title: 'File Upload'
  });
};

exports.postFileUpload = (req, res) => {
  req.flash('success', { msg: 'File was uploaded successfully.' });
  res.redirect('/api/upload');
};
