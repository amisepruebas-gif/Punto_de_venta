package push;

public class NotificacionRequest {
    private String destinatarioId;
    private String titulo;
    private String mensaje;

    public NotificacionRequest(String destinatarioId, String titulo, String mensaje) {
        this.destinatarioId = destinatarioId;
        this.titulo = titulo;
        this.mensaje = mensaje;
    }
}
