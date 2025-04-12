# Netlify Deployment Instructions

This application now uses Netlify Functions to securely handle API calls to OpenRouter, which improves security by keeping the API key on the server-side only.

## Security Improvements

- ✅ The OpenRouter API key is no longer exposed in the client-side code
- ✅ API calls now go through a secure serverless function
- ✅ Environment variables are properly segregated between client and server

## Deployment Steps

1. **Push your code to a GitHub repository** (if not already done)

2. **Connect to Netlify**:
   - Log in to [Netlify](https://app.netlify.com/)
   - Click "New site from Git"
   - Select your GitHub repository
   - Configure build settings:
     - Build command: `bun run build`
     - Publish directory: `dist`

3. **Set environment variables**:
   - After deployment, go to Site settings > Environment variables
   - Add the following variables:
     - `OPENROUTER_API_KEY`: Your OpenRouter API key (essential for the function to work)
     - `OPENROUTER_API_URL`: `https://openrouter.ai/api/v1/chat/completions` (can be omitted as the function has a fallback)

4. **Deploy your site**:
   - Trigger a new deployment to apply the environment variables

## Local Development

For local development with Netlify Functions:

1. Install the Netlify CLI:
   ```
   bun add -g netlify-cli
   ```

2. Create a `.env.local` file with your environment variables for local testing (already provided in the repo, but you need to update it):
   - Open `.env.local` and replace `your_key_here` with your actual OpenRouter API key
   - Do not commit this file to git (it's already in `.gitignore`)

3. Run the development server with Netlify Functions:
   ```
   netlify dev
   ```

## Function Logs

You can view function logs in the Netlify dashboard under Functions > your-function-name.
