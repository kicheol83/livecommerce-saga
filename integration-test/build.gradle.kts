dependencies {
    testImplementation(project(":order-service"))
    testImplementation(project(":payment-service"))
    testImplementation(project(":inventory-service"))
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    testImplementation("org.testcontainers:junit-jupiter")
    testImplementation("org.testcontainers:postgresql")
    testImplementation("org.testcontainers:kafka")
}
