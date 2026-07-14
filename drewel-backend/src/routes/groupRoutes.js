import express from 'express';  
import { requireSignIn } from '../middlewares/authMiddleware.js';
import { createGroup, getGroupById, getGroups, updateGroup } from '../controllers/groupController.js';

const router = express.Router();

router.post('/create-group', requireSignIn, createGroup);
router.get('/get-groups', requireSignIn, getGroups);
router.get('/get-group/:groupId', requireSignIn, getGroupById);
router.post('/update-group/:groupId', requireSignIn, updateGroup);
// router.delete('/delete-group/:groupId', requireSignIn, deleteGroup);
// router.post('/add-expense/:groupId', requireSignIn, addExpense);
// router.get('/get-expenses/:groupId', requireSignIn, getExpenses);


export default router;