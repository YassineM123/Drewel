import express from 'express';
import { requireSignIn } from '../middlewares/authMiddleware.js';
import { addFriends, getFriendsList, } from '../controllers/friendController.js';

const router = express.Router();

router.post('/add-friends', requireSignIn, addFriends);
router.get('/friend-list/:userId',getFriendsList)

export  default router;