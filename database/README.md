# Kayu Database

This folder contains the SQL scripts required to initialize the database for the Kayu Barcode Scanner application.

The database is designed to run seamlessly on [Supabase](https://supabase.com) (PostgreSQL), but will work on any standard PostgreSQL instance.

## Setup Instructions

1. Log in to your Supabase dashboard and open your project.
2. Navigate to the **SQL Editor** from the left sidebar.
3. Open a new query tab.
4. Copy and paste the entire contents of `schema.sql` into the editor.
5. Click **Run** to execute the script. This will create all the necessary tables.

## Schema Overview

The application relies on 3 main tables:

- **`users`**: Stores user accounts, securely hashed passwords (using bcrypt), and role-based access control (`user` or `admin`).
- **`user_scans`**: A personalized log of products scanned by authenticated users. It is linked to the `users` table via a foreign key (`user_id`).
- **`products`**: Acts as the local "Business Entities" database. It stores the product's environmental and health metrics (Eco-Score, Nutri-Score, additives). Admins can manage these via the Admin Panel.

## Admin Access

By default, new users are created with the `user` role. 
To access the Admin Panel, you must manually promote your account to an admin using the SQL Editor:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your_email@example.com';
```
