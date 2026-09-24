package com.livecommerce.live.chat

import com.livecommerce.live.auth.LiveUser
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.stereotype.Controller
import java.security.Principal

data class ChatMessageRequest(
    val text: String = ""
)

@Controller
class ChatMessageController(
    private val chatService: ChatService
) {

    @MessageMapping("/live/chat")
    fun chat(request: ChatMessageRequest, principal: Principal?) {
        val user = principal as? LiveUser ?: return
        chatService.post(user.nickname, request.text)
    }
}
