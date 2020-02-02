const cheerio = require('cheerio');
const GitHub = require('@octokit/rest');
const stripe = require('stripe')(process.env.STRIPE_SKEY);
const twilio = require('twilio')(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
const axios = require('axios');
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
