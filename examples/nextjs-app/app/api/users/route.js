const { nextAtozapi } = require('../../../../../sdk-js/nextjs');

const userSchema = {
  name: {
    type: 'string',
    required: true,
    minLength: 2
  },
  age: {
    type: 'number',
    required: true,
    min: 18,
    max: 120
  }
};

const POST = nextAtozapi({
  schema: userSchema,
  handler: async (req, { validatedBody }) => {
    return Response.json({
      id: Math.floor(Math.random() * 90000) + 10000,
      name: validatedBody.name,
      age: validatedBody.age,
      createdAt: new Date().toISOString()
    }, { status: 201 });
  }
});

module.exports = {
  POST
};
