require('dotenv').config(); // Load environment variables from .env
const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const mysql = require('mysql2');

// MySQL connection pool with error handling
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_DATABASE,
  port: process.env.DB_PORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Handle MySQL pool errors
pool.on('error', (err) => {
  console.error('Database connection pool error:', err);
});

// Centralized authentication function
const authenticate = (req) => {
  const apiKey = req.headers['authorization'];
  if (apiKey === process.env.API_KEY_ADMIN) {
    return { role: 'admin', userId: req.headers['user-id'] };
  } else if (apiKey === process.env.API_KEY_EMPLOYEE) {
    return { role: 'employee', userId: req.headers['user-id'] };
  }
  return { role: null, userId: null };
};

// GraphQL schema definition
const typeDefs = gql`
  type Employee {
    id: ID!
    name: String!
    age: Int!
    class: String!
    subjects: [String]!
    attendance: Boolean!
  }

  type Query {
    employees(page: Int, pageSize: Int, sortField: String, sortDirection: String, name: String, className: String): [Employee]
    employee(id: ID!): Employee
  }

  type Mutation {
    addEmployee(
      name: String!,
      age: Int!,
      class: String!,
      subjects: [String]!,
      attendance: Boolean!
    ): Employee
    updateEmployee(
      id: ID!,
      name: String,
      age: Int,
      class: String,
      subjects: [String],
      attendance: Boolean
    ): Employee
  }
`;

// GraphQL resolvers
const resolvers = {
  Query: {
    employees: async (parent, { page = 1, pageSize = 10, sortField = 'id', sortDirection = 'ASC', name, className }, context) => {
      try {
        if (context.role !== 'admin') {
          throw new Error('Unauthorized: Admin role is required');
        }

        const offset = (page - 1) * pageSize;
        const validSortDirections = ['ASC', 'DESC'];
        const direction = validSortDirections.includes(sortDirection.toUpperCase()) ? sortDirection.toUpperCase() : 'ASC';
        const validSortFields = ['id', 'name', 'age', 'class', 'attendance'];
        const field = validSortFields.includes(sortField) ? sortField : 'id';

        const filters = [];
        const filterParams = [];
        if (name) {
          filters.push('name LIKE ?');
          filterParams.push(`%${name}%`);
        }
        if (className) {
          filters.push('class LIKE ?');
          filterParams.push(`%${className}%`);
        }

        const filterQuery = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
        const query = `SELECT * FROM employees ${filterQuery} ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`;
        const [rows] = await pool.promise().query(query, [...filterParams, pageSize, offset]);

        // Parse subjects back from JSON string
        rows.forEach(employee => {
          if (employee.subjects) {
            employee.subjects = JSON.parse(employee.subjects);
          }
        });

        return rows;
      } catch (error) {
        throw new Error('Failed to fetch employees: ' + error.message);
      }
    },

    employee: async (parent, { id }, context) => {
      try {
        // Employees can only view their own data
        if (context.role === 'employee' && context.userId !== id) {
          throw new Error('Unauthorized: Employees can only view their own data');
        }

        const [rows] = await pool.promise().query('SELECT * FROM employees WHERE id = ?', [id]);

        if (rows[0] && rows[0].subjects) {
          rows[0].subjects = JSON.parse(rows[0].subjects);
        }

        return rows[0];
      } catch (error) {
        throw new Error('Failed to fetch employee: ' + error.message);
      }
    }
  },

  Mutation: {
    addEmployee: async (parent, { name, age, class: className, subjects, attendance }, context) => {
      try {
        // Only Admin can add employees
        if (context.role !== 'admin') {
          throw new Error('Unauthorized: Admin role is required');
        }

        const [result] = await pool.promise().query(
          'INSERT INTO employees (name, age, class, subjects, attendance) VALUES (?, ?, ?, ?, ?)',
          [name, age, className, JSON.stringify(subjects), attendance]
        );
        return { id: result.insertId, name, age, class: className, subjects, attendance };
      } catch (error) {
        throw new Error('Failed to add employee: ' + error.message);
      }
    },

    updateEmployee: async (parent, { id, name, age, class: className, subjects, attendance }, context) => {
      try {
        // Only Admin can update employees
        if (context.role !== 'admin') {
          throw new Error('Unauthorized: Admin role is required');
        }

        const [result] = await pool.promise().query(
          'UPDATE employees SET name = ?, age = ?, class = ?, subjects = ?, attendance = ? WHERE id = ?',
          [name, age, className, JSON.stringify(subjects), attendance, id]
        );
        return { id, name, age, class: className, subjects, attendance };
      } catch (error) {
        throw new Error('Failed to update employee: ' + error.message);
      }
    }
  }
};

// Create Apollo Server with context for API key and role
const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: ({ req }) => authenticate(req),
});

// Set up Express app with middleware
const app = express();

// Middleware for API key authentication (already handled in context)
app.use((req, res, next) => {
  const { role, userId } = authenticate(req);
  req.role = role;
  req.userId = userId;
  next(); // Continue to the next middleware
});

// Graceful shutdown logic
process.on('SIGINT', async () => {
  console.log('Closing server...');
  await pool.end();
  process.exit(0);
});

// Create an async function to start the server
async function startServer() {
  await server.start();
  server.applyMiddleware({ app });

  app.listen({ port: 4000 }, () => {
    console.log('Server running at http://localhost:4000/graphql');
  });
}

startServer();
