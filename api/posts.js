const express = require('express')
const router = express.Router()
const authMiddleware = require('../middleware/authMiddleware')
const UserModel = require('../models/UserModel')
const PostModel = require('../models/PostModel')
const FollowerModel = require('../models/FollowerModel')
const uuid = require('uuid').v4
const {
  newLikeNotification,
  removeLikeNotification,
  newCommentNotification,
  removeCommentNotification,
} = require('../utilsServer/notificationActions')

// CREATE A POST

router.post('/', authMiddleware, async (req, res) => {
  const { text, location, picUrl } = req.body

  if (text.length < 1) return res.status(401).send('Text must be atleast 1 character')

  try {
    const newPost = {
      user: req.userId,
      text,
    }
    if (location) newPost.location = location
    if (picUrl) newPost.picUrl = picUrl

    const post = await new PostModel(newPost).save()

    const postCreated = await PostModel.findById(post._id).populate('user')

    return res.json(postCreated)
  } catch (error) {
    console.error(error)
    return res.status(500).send(`Server error`)
  }
})

// GET ALL POSTS

router.get('/', authMiddleware, async (req, res) => {
  const { page } = req.query

  const number = Number(page)
  const size = 8

  try {
    let posts

    if (number === 1) {
      posts = await PostModel.find()
        .limit(size)
        .sort({ createdAt: -1 })
        .populate([{ path: 'user' }, { path: 'comments.user' }])
    } else {
      const skips = size * (number - 1)
      posts = await PostModel.find()
        .skip(skips)
        .limit(size)
        .sort({ createdAt: -1 })
        .populate([{ path: 'user' }, { path: 'comments.user' }])
    }

    if (posts.length === 0) {
      return res.json([])
    }

    let postsToBeSent = []
    const { userId } = req

    const loggedUser = await FollowerModel.findOne({ user: userId })

    if (loggedUser.following.length === 0) {
      postsToBeSent = posts.filter((post) => post.user._id.toString() === userId)
    } else {
      for (let i = 0; i < loggedUser.following.length; i++) {
        const foundPostsFromFollowing = posts.filter(
          (post) => post.user._id.toString() === loggedUser.following[i].user.toString()
        )

        if (foundPostsFromFollowing.length > 0) postsToBeSent.push(...foundPostsFromFollowing)
      }

      const foundOwnPosts = posts.filter((post) => post.user._id.toString() === userId)
      if (foundOwnPosts.length > 0) postsToBeSent.push(...foundOwnPosts)
    }

    postsToBeSent.length > 0 &&
      postsToBeSent.sort((a, b) => [new Date(b.createdAt) - new Date(a.createdAt)])

    return res.json(postsToBeSent)
  } catch (error) {
    console.error(error)
    return res.status(500).send(`Server error`)
  }
})

// GET POST BY ID

router.get('/:postId', authMiddleware, async (req, res) => {
  try {
    const post = await PostModel.findById(req.params.postId).populate([
      { path: 'user' },
      { path: 'comments.user' },
    ])

    if (!post) {
      return res.status(404).send('Post not found')
    }

    return res.json(post)
  } catch (error) {
    console.error(error)
    return res.status(500).send(`Server error`)
  }
})

// DELETE POST

router.delete('/:postId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req

    const { postId } = req.params

    const post = await PostModel.findById(postId)
    if (!post) {
      return res.status(404).send('post not found')
    }

    const user = await UserModel.findById(userId)

    if (post.user.toString() !== userId) {
      if (user.role === 'root') {
        await post.remove()
        return res.status(200).send('Post deleted Successfully')
      } else {
        return res.status(401).send('Unauthorized')
      }
    }

    await post.remove()
    return res.status(200).send('Post deleted Successfully')
  } catch (error) {
    console.error(error)
    return res.status(500).send(`Server error`)
  }
})

// LIKE A POST

router.post('/like/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params
    const { userId } = req

    const post = await PostModel.findById(postId)
    if (!post) {
      return res.status(404).send('No Post found')
    }

    const isLiked = post.likes.filter((like) => like.user.toString() === userId).length > 0

    if (isLiked) {
      return res.status(401).send('Post already liked')
    }

    await post.likes.unshift({ user: userId })
    await post.save()

    if (post.user.toString() !== userId) {
      await newLikeNotification(userId, postId, post.user.toString())
    }

    return res.status(200).send('Post liked')
  } catch (error) {
    console.error(error)
    return res.status(500).send(`Server error`)
  }
})

// UNLIKE A POST

router.put('/unlike/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params
    const { userId } = req

    const post = await PostModel.findById(postId)
    if (!post) {
      return res.status(404).send('No Post found')
    }

    const isLiked = post.likes.filter((like) => like.user.toString() === userId).length === 0

    if (isLiked) {
      return res.status(401).send('Post not liked before')
    }

    const index = post.likes.map((like) => like.user.toString()).indexOf(userId)

    await post.likes.splice(index, 1)

    await post.save()

    if (post.user.toString() !== userId) {
      await removeLikeNotification(userId, postId, post.user.toString())
    }

    return res.status(200).send('Post Unliked')
  } catch (error) {
    console.error(error)
    return res.status(500).send(`Server error`)
  }
})

// GET ALL LIKES OF A POST

router.get('/like/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params

    const post = await PostModel.findById(postId).populate('likes.user')
    if (!post) {
      return res.status(404).send('No Post found')
    }

    return res.status(200).json(post.likes)
  } catch (error) {
    console.error(error)
    return res.status(500).send(`Server error`)
  }
})

// CREATE A COMMENT

router.post('/comment/:postId', authMiddleware, async (req, res) => {
  try {
    const { postId } = req.params

    const { userId } = req
    const { text } = req.body

    if (text.length < 1) return res.status(401).send('Comment should be atleast 1 character')

    const post = await PostModel.findById(postId)

    if (!post) return res.status(404).send('Post not found')

    const newComment = {
      _id: uuid(),
      text,
      user: userId,
      date: Date.now(),
    }

    await post.comments.unshift(newComment)
    await post.save()

    if (post.user.toString() !== userId) {
      await newCommentNotification(postId, newComment._id, userId, post.user.toString(), text)
    }

    return res.status(200).json(newComment._id)
  } catch (error) {
    console.error(error)
    return res.status(500).send(`Server error`)
  }
})

// DELETE A COMMENT

router.delete('/:postId/:commentId', authMiddleware, async (req, res) => {
  try {
    const { postId, commentId } = req.params
    const { userId } = req

    const post = await PostModel.findById(postId)
    if (!post) return res.status(404).send('Post not found')

    const comment = post.comments.find((comment) => comment._id === commentId)
    if (!comment) {
      return res.status(404).send('No Comment found')
    }

    const user = await UserModel.findById(userId)

    const deleteComment = async () => {
      const indexOf = post.comments.map((comment) => comment._id).indexOf(commentId)

      await post.comments.splice(indexOf, 1)

      await post.save()

      if (post.user.toString() !== userId) {
        await removeCommentNotification(postId, commentId, userId, post.user.toString())
      }

      return res.status(200).send('Deleted Successfully')
    }

    if (comment.user.toString() !== userId) {
      if (user.role === 'root') {
        await deleteComment()
      } else {
        return res.status(401).send('Unauthorized')
      }
    }

    await deleteComment()
  } catch (error) {
    console.error(error)
    return res.status(500).send(`Server error`)
  }
})

module.exports = router
