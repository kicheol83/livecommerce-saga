dependencies {
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("com.fasterxml.jackson.module:jackson-module-kotlin")
    testRuntimeOnly("org.postgresql:postgresql")
}

val testSourceSet = the<SourceSetContainer>()["test"]

tasks.withType<Test> {
    systemProperty("junit.jupiter.execution.timeout.default", "5m")
}

tasks.named<Test>("test") {
    useJUnitPlatform {
        excludeTags("chaos")
    }
    outputs.upToDateWhen { false }
    testLogging {
        events("passed", "failed", "skipped")
    }
}

tasks.register<Test>("chaosTest") {
    description = "Runs chaos scenarios that stop and restart infrastructure of the running stack"
    group = "verification"
    testClassesDirs = testSourceSet.output.classesDirs
    classpath = testSourceSet.runtimeClasspath
    useJUnitPlatform {
        includeTags("chaos")
    }
    outputs.upToDateWhen { false }
    testLogging {
        events("passed", "failed", "skipped")
    }
}
