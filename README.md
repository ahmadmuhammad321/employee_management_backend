You need to add these Headers while sending api requests declared in .env file

Authorization {Admin_API_KEY or Employee_API_KEY}
user-id {user-id of an employee}

Authorization: is to assign role
user-id: is required in case of identifying which user is trying to access, because an employee can view only its own details