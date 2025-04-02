# TPS Report Management System

A web application for creating, reviewing, and managing TPS (Trust, Pleasure, Safety) Reports with advanced PDF form management capabilities.

## Features

- PDF form viewing and editing
- Workflow with draft, review, and approval states
- User authentication
- Report statistics
- Mobile-responsive design

## Prerequisites

To run this application on your Mac Mini, you'll need:

- Node.js (v18.x or higher)
- npm (v9.x or higher)
- PostgreSQL (v14.x or higher)
- Git

## Installation Instructions for Mac Mini

Follow these steps to set up and run the application on your Mac Mini:

### 1. Install Prerequisites

#### Install Homebrew (if not already installed)

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### Install Node.js and npm

```bash
brew install node@18
```

#### Install PostgreSQL

```bash
brew install postgresql@14
```

Start PostgreSQL service:

```bash
brew services start postgresql@14
```

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/tps-report-system.git
cd tps-report-system
```

### 3. Set Up the Database

Create a PostgreSQL user and database:

```bash
createuser -P tpsuser  # Follow prompts to create a password
createdb -O tpsuser tpsreports
```

### 4. Configure Environment Variables

Create a `.env` file in the project root with the following content:

```
DATABASE_URL=postgres://tpsuser:yourpassword@localhost:5432/tpsreports
```

Replace `yourpassword` with the password you set for the `tpsuser`.

### 5. Install Dependencies

```bash
npm install
```

### 6. Initialize the Database

```bash
npm run db:push
```

This will create the tables and initial data in your database.

### 7. Start the Application

```bash
npm run dev
```

The application should now be running at `http://localhost:5000`.

## Usage

1. Navigate to `http://localhost:5000` in your browser
2. Log in with one of the default users:
   - Username: `matt` / Password: `password`
   - Username: `mina` / Password: `password`
3. Create, edit, and manage TPS Reports

## Application Structure

- `client/` - React frontend code
- `server/` - Express.js backend code
- `shared/` - Shared types and schemas
- `drizzle/` - Database migration files

## Development

### Available Scripts

- `npm run dev` - Start the development server
- `npm run db:push` - Update the database schema
- `npm run build` - Build the application for production
- `npm run start` - Start the production server

## Troubleshooting

### PDF Display Issues
If you encounter problems with PDF display or form fields:
- Make sure your browser supports PDF.js
- Check the console for any JavaScript errors
- Verify that the PDF template file exists in the `/storage/pdfs/` directory

### Database Connection Issues
If you have problems connecting to the database:
- Verify PostgreSQL is running: `brew services list`
- Check your DATABASE_URL environment variable
- Ensure the database user has proper permissions

### Permissions Issues
If you encounter file permission problems:
- Ensure the application has write access to the storage directory
- Check ownership of the project directories

## Additional Configuration

### Running as a Service

To run the application as a service on your Mac Mini, you can use `pm2`:

```bash
npm install -g pm2
pm2 start npm --name "tps-system" -- run start
pm2 startup
pm2 save
```

This will ensure the application starts automatically when your Mac Mini reboots.

### Enabling HTTPS

For production use, it's recommended to set up HTTPS. You can use a reverse proxy like Nginx with Let's Encrypt certificates.

## License

[MIT License](LICENSE)