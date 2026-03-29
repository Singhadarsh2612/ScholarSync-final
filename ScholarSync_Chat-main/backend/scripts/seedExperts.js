/**
 * Seed script to create all 10 subject experts
 * Run: node scripts/seedExperts.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const dns = require('dns');

// Force using Google DNS to resolve MongoDB Atlas SRV records
dns.setServers(['8.8.8.8', '8.8.4.4']);

const Expert = require('../models/Expert');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/scholarsync_chat';

const experts = [
  {
    name: 'Ananya Sharma',
    subject: 'computer_networks',
    subjectLabel: 'Computer Networks',
    description: 'Senior year student who scored 100/100 in Computer Networks. Built a custom TCP/IP networking stack in C from scratch and completely dominated the state-level hackathon by optimizing peer-to-peer routing protocols.',
    email: 'cn.expert@scholarsync.com',
    password: 'expert@123',
  },
  {
    name: 'Rajesh Kumar',
    subject: 'operating_systems',
    subjectLabel: 'Operating Systems',
    description: 'OS topper with a perfect 10 CGPA. Wrote a custom Linux kernel module for memory management and consistently aces viva exams. Can debug race conditions and deadlocks in his sleep.',
    email: 'os.expert@scholarsync.com',
    password: 'expert@123',
  },
  {
    name: 'Priya Verma',
    subject: 'database_management_system',
    subjectLabel: 'Database Management System',
    description: 'Database prodigy who ranks #1 in her batch. Restructured the college portal DB for 10x faster queries using advanced indexing and normalization. Absolute master of complex SQL joins.',
    email: 'dbms.expert@scholarsync.com',
    password: 'expert@123',
  },
  {
    name: 'Arjun Mehta',
    subject: 'software_engineering',
    subjectLabel: 'Software Engineering',
    description: 'Lead student developer for the university\'s official app. Unmatched expertise in design patterns, clean architecture, and Agile workflow. Known for writing the most flawlessly documented and maintainable code.',
    email: 'se.expert@scholarsync.com',
    password: 'expert@123',
  },
  {
    name: 'Sneha Patel',
    subject: 'data_structures_and_algorithms',
    subjectLabel: 'Data Structures and Algorithms',
    description: 'Candidate Master on Codeforces and Grandmaster on LeetCode. Solved over 1500+ algorithmic problems. Runs the college competitive programming club and routinely crushes coding interviews.',
    email: 'dsa.expert@scholarsync.com',
    password: 'expert@123',
  },
  {
    name: 'Vikram Singh',
    subject: 'greedy',
    subjectLabel: 'Greedy Algorithms',
    description: 'Competitive programming beast specialized in optimization and greedy techniques. If a problem can be solved by sorting and picking the best local optimum, Vikram will find the O(N log N) solution instantly.',
    email: 'greedy.expert@scholarsync.com',
    password: 'expert@123',
  },
  {
    name: 'Kavita Joshi',
    subject: 'math',
    subjectLabel: 'Mathematics',
    description: 'Math Olympiad Gold Medalist. Perfectly translates complex number theory, combinatorics, and probability concepts into logic for computer science. Her mathematical proofs for algorithm correctness are legendary.',
    email: 'math.expert@scholarsync.com',
    password: 'expert@123',
  },
  {
    name: 'Rohan Das',
    subject: 'binary_search',
    subjectLabel: 'Binary Search',
    description: 'The absolute authority on Binary Search on Answer concepts. He has never written an infinite loop or off-by-one error in his binary searches. Frequently speed-runs competitive coding rounds.',
    email: 'bs.expert@scholarsync.com',
    password: 'expert@123',
  },
  {
    name: 'Divya Nair',
    subject: 'two_pointers',
    subjectLabel: 'Two Pointers',
    description: 'Master of array manipulation, sliding windows, and two-pointer techniques. She holds the college record for the fastest time resolving string and subarray problems on coding platforms without using extra space.',
    email: 'tp.expert@scholarsync.com',
    password: 'expert@123',
  },
  {
    name: 'Amit Tiwari',
    subject: 'graph',
    subjectLabel: 'Graph Algorithms',
    description: 'Graph theory wizard. From Dijkstra and Bellman-Ford to advanced Heavy-Light Decomposition and network flows, Amit visualizes and codes complex graph logic flawlessly on the first try.',
    email: 'graph.expert@scholarsync.com',
    password: 'expert@123',
  },
];

const seed = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log("🔗 Connecting to:", process.env.MONGO_URI || process.env.MONGODB_URI);
    // Clear existing experts
    await Expert.deleteMany({});
    console.log('🗑️  Cleared existing experts');

    // Insert new experts
    for (const expertData of experts) {
      const expert = new Expert(expertData);
      await expert.save(); // triggers password hashing
      console.log(`✅ Created expert: ${expert.name} (${expert.subjectLabel})`);
    }

    console.log('\n🎉 All 10 experts seeded successfully!');
    console.log('\n📧 Login credentials (all same password):');
    experts.forEach(e => console.log(`   ${e.email} / expert@123`));

  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

seed();
