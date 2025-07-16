const express = require("express");
const cors = require("cors");
const app = express();
const stripe = require("stripe")(
  "process.env.STRIPE_KEY"
);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const port = process.env.PORT || 5000;
require("dotenv").config();

app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res.send("Sports Club running");
});

app.listen(port, () => {
  console.log("SportiVox is running Port", port);
});

// ;
//

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gi7ojox.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const UserCollection = client.db("SportiVox").collection("Users");
const courtCollection = client.db("SportiVox").collection("Courts");
const bookingsCollection = client.db("SportiVox").collection("Booking");
const paymentsCollection = client.db("SportiVox").collection("payments");
const couponsCollection = client.db("SportiVox").collection("Coupons");
const announcementsCollection = client
  .db("SportiVox")
  .collection("Announcements");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection

    // Users info post
    app.post("/Users", async (req, res) => {
      const Users = req.body;
      const result = await UserCollection.insertOne(Users);
      res.send(result);
    });

    // Users info get
    app.get("/Users", async (req, res) => {
      const email = req.query.email;
      let query = {};
      if (email) {
        query.email = email;
      }

      const result = await UserCollection.find(query).toArray();
      res.send(result);
    });

    // Get all courts
    app.get("/courts", async (req, res) => {
      const courts = await courtCollection.find().toArray();
      res.send(courts);
    });

    // Add court
    app.post("/courts", async (req, res) => {
      const result = await courtCollection.insertOne(req.body);
      res.send(result);
    });

    // Update court
    app.put("/courts/:id", async (req, res) => {
      const id = req.params.id;
      const updated = req.body;
      const result = await courtCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updated }
      );
      res.send(result);
    });

    // Delete court
    app.delete("/courts/:id", async (req, res) => {
      const id = req.params.id;
      const result = await courtCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Booking Collection

    app.post("/bookings", async (req, res) => {
      const booking = req.body;

      if (!booking || !booking.userEmail || !booking.courtId || !booking.date) {
        return res.status(400).json({ message: "Missing booking data" });
      }

      try {
        const result = await bookingsCollection.insertOne({
          ...booking,
          status: "pending", // Ensure default status is pending
          createdAt: new Date(),
        });

        res
          .status(201)
          .json({ message: "Booking created", id: result.insertedId });
      } catch (error) {
        console.error("Booking error:", error);
        res.status(500).json({ message: "Server error" });
      }
    });

    // GET /bookings?status=pending
    app.get("/bookings", async (req, res) => {
      try {
        const status = req.query.status;
        const paymentStatus = req.query.paymentStatus;
        const email = req.query.email;
        const query = {};

        if (status) query.status = status;
        if (paymentStatus) query.paymentStatus = paymentStatus;
        if (email) query.userEmail = email; // ✅ fix here

        const bookings = await bookingsCollection.find(query).toArray();
        res.send(bookings);
      } catch (err) {
        console.error("Error fetching bookings:", err);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    app.delete("/bookings/:id", async (req, res) => {
      const _id = req.params.id;

      try {
        const result = await bookingsCollection.deleteOne({
          _id: new ObjectId(_id),
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Booking not found" });
        }

        res.status(200).json({
          message: "Booking cancelled successfully",
          deletedCount: result.deletedCount, // 🟢 এই লাইনটা যোগ করো
        });
      } catch (err) {
        console.error("Delete booking error:", err);
        res.status(500).json({ message: "Server error" });
      }
    });

    app.put("/bookings/approve/:id", async (req, res) => {
      const id = req.params.id;

      try {
        const booking = await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!booking) {
          return res.status(404).json({ message: "Booking not found" });
        }

        if (booking.status === "approved") {
          return res.status(200).json({
            message: "Already approved",
            bookingModified: 0,
            userModified: 0,
          });
        }

        // 1. Approve the booking
        const bookingUpdate = await bookingsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "approved" } }
        );

        // 2. Get the user
        const user = await UserCollection.findOne({ email: booking.userEmail });

        let userUpdateResult = { modifiedCount: 0 };

        // 3. Only update if user is not already an admin
        if (user && user.role !== "admin") {
          userUpdateResult = await UserCollection.updateOne(
            { email: booking.userEmail },
            { $set: { role: "member", memberDate: new Date() } }
          );
        }

        res.send({
          bookingModified: bookingUpdate.modifiedCount,
          userModified: userUpdateResult.modifiedCount,
          message:
            "Booking approved" +
            (user?.role === "admin"
              ? " (User is admin, role unchanged)"
              : " and user promoted to member"),
        });
      } catch (err) {
        console.error("Approval error:", err);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Payment intent

    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency: "usd", // or "bdt" if supported
          payment_method_types: ["card"],
        });

        res.send({
          clientSecret: paymentIntent.client_secret,
        });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });

    // Mark as paid
    app.patch("/bookings/payment/:id", async (req, res) => {
      const id = req.params.id;
      const result = await bookingsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { paymentStatus: "paid" } }
      );
      res.send(result);
    });

    // Save payment info to DB
    app.post("/payments", async (req, res) => {
      try {
        const payment = req.body;

        const result = await paymentsCollection.insertOne(payment);

        res.send(result);
      } catch (err) {
        console.error("Error saving payment:", err);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // Example Route: /payments?email=shutshob@gmail.com
    app.get("/payments", async (req, res) => {
      try {
        const email = req.query.email;
        const payments = await paymentsCollection
          .find({ userEmail: email })
          .sort({ createdAt: -1 }) // latest first
          .toArray();

        res.send(payments);
      } catch (err) {
        console.error("Error fetching payments:", err);
        res.status(500).send({ error: "Failed to fetch payments" });
      }
    });
    // GET /members
    app.get("/members", async (req, res) => {
      try {
        const approvedBookings = await bookingsCollection
          .find({ status: "approved", paymentStatus: "paid" }) // only paid approved users
          .toArray();

        // Group unique users by email
        const membersMap = {};
        approvedBookings.forEach((b) => {
          if (!membersMap[b.userEmail]) {
            membersMap[b.userEmail] = {
              userName: b.userName,
              userEmail: b.userEmail,
            };
          }
        });

        const uniqueMembers = Object.values(membersMap);
        res.send(uniqueMembers);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch members" });
      }
    });
    // DELETE /members/:email
    app.delete("/members/:email", async (req, res) => {
      const email = req.params.email;

      try {
        // Remove user from users collection
        const userResult = await UserCollection.deleteOne({ email });

        // Remove all bookings
        const bookingResult = await bookingsCollection.deleteMany({
          userEmail: email,
        });
        // Remove all payments
        const PaymentResult = await paymentsCollection.deleteMany({
          userEmail: email,
        });

        if (
          userResult.deletedCount > 0 ||
          bookingResult.deletedCount > 0 ||
          PaymentResult.deletedCount > 0
        ) {
          res.send({
            message: "Deleted successfully",
            deletedCount: bookingResult.deletedCount,
          });
        } else {
          res.send({ message: "No data found", deletedCount: 0 });
        }
      } catch (error) {
        console.error("Delete member error:", error);
        res.status(500).send({ error: "Failed to delete member" });
      }
    });

    // GET /users
    app.get("/users", async (req, res) => {
      try {
        const role = req.query.role;
        const query = role ? { role } : {};
        const users = await UserCollection.find(query).toArray();
        res.send(users);
      } catch (err) {
        console.error("Failed to get users", err);
        res.status(500).send({ error: "Internal Server Error" });
      }
    });

    // PATCH /users/role/:email
    app.patch("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const { role } = req.body;

      if (!["user", "member", "admin"].includes(role)) {
        return res.status(400).send({ error: "Invalid role" });
      }

      const result = await UserCollection.updateOne(
        { email },
        { $set: { role } }
      );

      res.send(result);
    });

    // DELETE /users/:email
    app.delete("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await UserCollection.deleteOne({ email });
      res.send(result);
    });

    // Coupons Section

    app.get("/coupons", async (req, res) => {
      const code = req.query.code;
      if (!code) return res.status(400).send({ error: "Coupon code required" });

      const coupon = await couponsCollection.findOne({ code });
      if (!coupon) return res.status(404).send(null);

      res.send(coupon);
    });

    app.get("/all_coupons", async (req, res) => {
      try {
        const coupons = await couponsCollection.find().toArray();
        res.send(coupons);
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch coupons" });
      }
    });

    app.post("/coupons", async (req, res) => {
      const result = await couponsCollection.insertOne(req.body);
      res.send(result);
    });

    app.patch("/coupons/:id", async (req, res) => {
      const id = req.params.id;
      const { code, type, value, description } = req.body;

      const updateDoc = {
        code,
        type,
        value,
        description,
      };

      Object.keys(updateDoc).forEach(
        (key) => updateDoc[key] === undefined && delete updateDoc[key]
      );

      try {
        const result = await couponsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateDoc }
        );
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Update failed" });
      }
    });

    app.delete("/coupons/:id", async (req, res) => {
      const id = req.params.id;
      const result = await couponsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // GET all announcements
    // ✅ GET all announcements
    app.get("/announcements", async (req, res) => {
      const announcements = await announcementsCollection.find().toArray();
      res.send(announcements);
    });

    // ✅ POST add new announcement
    app.post("/announcements", async (req, res) => {
      const { title, description } = req.body;

      const announcement = {
        title,
        description, // ✅ Corrected field name
        date: new Date(),
      };

      const result = await announcementsCollection.insertOne(announcement);
      res.send(result);
    });

    // PATCH update announcement
    app.patch("/announcements/:id", async (req, res) => {
      const id = req.params.id;
      const { title, description } = req.body;
      const result = await announcementsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { title, description } }
      );
      res.send(result);
    });

    // DELETE announcement
    app.delete("/announcements/:id", async (req, res) => {
      const id = req.params.id;
      const result = await announcementsCollection.deleteOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
