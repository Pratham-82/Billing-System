# Local Setup Guide: Speaking Wall Interio Billing System

Follow these steps to run the wallpaper billing system on another local computer.

---

## 1. Prerequisites

Before transferring the files, ensure the target machine has the following software installed:

1. **Node.js (LTS Version)**
   - Download and install Node.js from [nodejs.org](https://nodejs.org/).
   - Verifies installation: Open command prompt/terminal and check versions:
     ```bash
     node -v
     npm -v
     ```
2. **MongoDB**
   - Download and install **MongoDB Community Server** from [mongodb.com](https://www.mongodb.com/try/download/community).
   - Ensure the MongoDB service is running locally. (Usually, the installer sets up MongoDB to run automatically in the background as a local service on port `27017`).

---

## 2. Transferring the Files

To package and move the project files cleanly:

1. **Exclude Node Modules**: Zip the project directory but **do not include** the `node_modules` directories, as they are very large and can be regenerated easily.
   - **Delete/Skip** these folders when zipping:
     - `node_modules` (in root directory)
     - `client/node_modules` (in client directory)
     - `server/node_modules` (in server directory)
2. **Copy Zip**: Transfer the ZIP file to the new machine using a USB drive, local network, email, etc., and extract it to a directory.

---

## 3. Configuration

On the new machine:

1. Navigate to the `server` folder.
2. Check if a `.env` file exists. If it does not, copy `.env.example` and rename it to `.env`.
3. Verify that the `.env` contents match the local environment:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/wallpaper_billing
   ```
   *(Change `127.0.0.1:27017` only if your local MongoDB installation runs on a custom port or hosts database online).*

---

## 4. Install Dependencies & Run

1. Open your terminal (PowerShell, Command Prompt, or terminal app) in the **root folder** of the extracted project.
2. **Install all dependencies** automatically by running:
   ```bash
   npm run install-all
   ```
   *(This helper script automatically runs `npm install` in the root, client, and server directories).*
3. **Start the application** in development mode:
   ```bash
   npm run dev
   ```
4. **Access the App**:
   - The React client runs on: [http://localhost:3000/](http://localhost:3000/)
   - The Express backend API runs on: [http://localhost:5000/](http://localhost:5000/)
   - Open your browser to [http://localhost:3000/](http://localhost:3000/) to use the system!
