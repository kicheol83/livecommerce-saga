package com.livecommerce.live.api

import com.livecommerce.live.api.dto.LiveSessionResponse
import com.livecommerce.live.chat.ChatMessage
import com.livecommerce.live.chat.ChatService
import com.livecommerce.live.session.LiveSessionService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/live")
class LiveController(
    private val liveSessionService: LiveSessionService,
    private val chatService: ChatService
) {

    @GetMapping("/session")
    fun session(): LiveSessionResponse {
        return liveSessionService.currentSession()
    }

    @GetMapping("/chat")
    fun chat(): List<ChatMessage> {
        return chatService.history()
    }
}
