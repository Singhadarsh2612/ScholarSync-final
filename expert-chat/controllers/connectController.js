const { v4: uuidv4 } = require('uuid');

const { CLIENT_URL } = require('../config/env');
const Expert = require('../models/Expert');
const ChatRoom = require('../models/ChatRoom');

const SUBJECT_MAP = {
  'computer_networks': 'computer_networks',
  'computer-networks': 'computer_networks',
  'computernetworks': 'computer_networks',
  'cn': 'computer_networks',

  'operating_systems': 'operating_systems',
  'operating-systems': 'operating_systems',
  'os': 'operating_systems',

  'database_management_system': 'database_management_system',
  'dbms': 'database_management_system',
  'database': 'database_management_system',

  'software_engineering': 'software_engineering',
  'se': 'software_engineering',

  'data_structures_and_algorithms': 'data_structures_and_algorithms',
  'dsa': 'data_structures_and_algorithms',
  'data-structures': 'data_structures_and_algorithms',

  'greedy': 'greedy',

  'math': 'math',
  'mathematics': 'math',

  'binary_search': 'binary_search',
  'binary-search': 'binary_search',
  'bs': 'binary_search',

  'two_pointers': 'two_pointers',
  'two-pointers': 'two_pointers',
  'tp': 'two_pointers',

  'graph': 'graph',
  'graphs': 'graph',
};

const connectUser = async (req, res) => {
  try {
    const subjectRaw = (req.query.subject || '').toLowerCase().trim();

    if (!subjectRaw) {
      return res.status(400).json({ message: 'subject query parameter is required' });
    }

    const subjectKey = SUBJECT_MAP[subjectRaw];
    if (!subjectKey) {
      return res.status(400).json({
        message: `Unknown subject: "${subjectRaw}"`,
        availableSubjects: Object.keys(SUBJECT_MAP),
      });
    }

    const expert = await Expert.findOne({ subject: subjectKey });
    if (!expert) {
      return res.status(404).json({ message: `No expert found for subject: ${subjectKey}` });
    }

    const roomId = uuidv4();
    const studentId = req.query.studentId || null;

    await ChatRoom.create({
      roomId,
      expertId: expert._id,
      subject: subjectKey,
      studentId,
    });

    const chatUrl = `/chat/${roomId}`;
    const fullUrl = `${CLIENT_URL}${chatUrl}`;

    res.json({
      roomId,
      chatUrl,
      fullUrl,
      expert: {
        name: expert.name,
        subject: expert.subjectLabel,
        description: expert.description,
        isOnline: expert.isOnline,
      },
    });
  } catch (error) {
    console.error('Connect error:', error);
    res.status(500).json({ message: 'Server error creating chat room' });
  }
};

const connectAndRedirect = async (req, res) => {
  try {
    const subjectRaw = (req.query.subject || '').toLowerCase().trim();
    if (!subjectRaw) return res.status(400).send('subject query parameter is required');

    const subjectKey = SUBJECT_MAP[subjectRaw];
    if (!subjectKey) return res.status(400).send(`Unknown subject: "${subjectRaw}"`);

    const expert = await Expert.findOne({ subject: subjectKey });
    if (!expert) return res.status(404).send(`No expert found for subject: ${subjectKey}`);

    const studentId = req.query.studentId || null;
    let roomId;

    if (studentId) {
      const existingRoom = await ChatRoom.findOne({
        studentId,
        expertId: expert._id,
        isActive: true,
      });

      if (existingRoom) {
        roomId = existingRoom.roomId;
      }
    }

    if (!roomId) {
      roomId = uuidv4();
      await ChatRoom.create({
        roomId,
        expertId: expert._id,
        subject: subjectKey,
        studentId,
      });
    }

    const fullUrl = `${CLIENT_URL}/chat/${roomId}`;
    res.redirect(fullUrl);
  } catch (error) {
    console.error('Redirect Connect error:', error);
    res.status(500).send('Server error creating chat room');
  }
};

const getAllExperts = async (req, res) => {
  try {
    const studentId = req.query.studentId || null;
    const allExperts = await Expert.find({});
    
    const activeRooms = studentId 
      ? await ChatRoom.find({ studentId, isActive: true })
      : [];

    const result = await Promise.all(allExperts.map(async expert => {
      let room = activeRooms.find(r => r.expertId.toString() === expert._id.toString());

      // Without a studentId there is no per-student room to look up, so reuse
      // this expert's existing anonymous room. Previously a fresh room was
      // persisted on every request, so each anonymous call to this endpoint
      // leaked one ChatRoom per expert.
      if (!room && !studentId) {
        room = await ChatRoom.findOne({
          studentId: null,
          expertId: expert._id,
          isActive: true,
        });
      }

      if (!room) {
        room = await ChatRoom.create({
          roomId: uuidv4(),
          expertId: expert._id,
          subject: expert.subject,
          studentId,
        });
      }

      const finalRoomId = room.roomId;

      const chatUrl = `/chat/${finalRoomId}`;
      const fullUrl = `${CLIENT_URL}${chatUrl}`;

      return {
        roomId: finalRoomId,
        chatUrl,
        fullUrl,
        expert: {
          name: expert.name,
          subject: expert.subjectLabel,
          description: expert.description,
          isOnline: expert.isOnline,
        }
      };
    }));

    res.json(result);
  } catch (error) {
    console.error('Get All Experts error:', error);
    res.status(500).json({ message: 'Server error fetching experts' });
  }
};

module.exports = { connectUser, getAllExperts, connectAndRedirect };
