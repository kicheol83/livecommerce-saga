package com.livecommerce.integration

import org.testcontainers.containers.KafkaContainer
import org.testcontainers.containers.PostgreSQLContainer
import org.testcontainers.utility.DockerImageName

class KPostgresContainer(image: String) : PostgreSQLContainer<KPostgresContainer>(image)

class KKafkaContainer(image: DockerImageName) : KafkaContainer(image)
