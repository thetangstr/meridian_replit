import fetch from 'node-fetch';
import fs from 'fs';

async function loginAsTony() {
  const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: 'tony',
    }),
  });

  if (!loginResponse.ok) {
    console.error('Login failed:', await loginResponse.text());
    return null;
  }

  const cookies = loginResponse.headers.get('set-cookie');
  return cookies;
}

async function createReview(cookies) {
  const reviewData = {
    carId: 3,
    reviewerId: 3,
    status: 'in_progress',
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
    cujDatabaseVersionId: 1,
  };

  const response = await fetch('http://localhost:5000/api/reviews', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookies
    },
    body: JSON.stringify(reviewData),
  });

  if (!response.ok) {
    console.error('Failed to create review:', await response.text());
    return null;
  }

  const review = await response.json();
  console.log('Review created successfully:', review);
  return review;
}

async function main() {
  try {
    console.log('Logging in as Tony...');
    const cookies = await loginAsTony();
    
    if (!cookies) {
      console.error('Failed to get authentication cookies');
      return;
    }
    
    console.log('Saving cookies to file...');
    fs.writeFileSync('cookies_tony.txt', cookies);
    
    console.log('Creating review for Tony...');
    const review = await createReview(cookies);
    
    if (review) {
      console.log('Review created with ID:', review.id);
      console.log('Tony should now be able to see this review in the dashboard');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

main();